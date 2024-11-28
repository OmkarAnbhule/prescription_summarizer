import { NextResponse } from 'next/server';
import multer from 'multer';
import axios from 'axios';
import Groq from "groq-sdk";
import Tesseract, { createWorker } from 'tesseract.js'; // Add this for OCR

const upload = multer({ storage: multer.memoryStorage() });
const assemblyAIAPIKey = process.env.ASSEMBLYAI_API_KEY;
// Default

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Function to transcribe audio using AssemblyAI
const transcribeAudio = async (audioBuffer) => {
    try {
        const response = await axios.post('https://api.assemblyai.com/v2/upload', audioBuffer, {
            headers: {
                'authorization': assemblyAIAPIKey,
                'Content-Type': 'application/octet-stream'
            }
        });

        const audioUrl = response.data.upload_url;

        const transcriptionResponse = await axios.post('https://api.assemblyai.com/v2/transcript', {
            audio_url: audioUrl
        }, {
            headers: {
                'authorization': assemblyAIAPIKey,
                'Content-Type': 'application/json'
            }
        });

        const transcriptId = transcriptionResponse.data.id;

        // Polling for the transcription result
        let transcriptionResult;
        while (true) {
            const resultResponse = await axios.get(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
                headers: {
                    'authorization': assemblyAIAPIKey
                }
            });

            if (resultResponse.data.status === 'completed') {
                transcriptionResult = resultResponse.data.text;
                break;
            } else if (resultResponse.data.status === 'failed') {
                throw new Error('Transcription failed');
            }

            // Wait before polling again
            await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5 seconds
        }

        return transcriptionResult;
    } catch (error) {
        console.error('Error during audio transcription:', error);
        throw error;
    }
};

// Function to extract relevant details from transcription
const extractRelevantDetails = (transcription) => {
    // Define regex patterns to extract relevant information
    const medicinePattern = /(\w+\s+\w+)(?=\s*\d+\s+(Morning|Night|Evening|After Food))/g; // Matches medicine names followed by dosage info
    const diseasePattern = /(malaria|fever|chills|headache)/gi; // Matches relevant diseases (you can add more as needed)

    // Extract medicines and diseases
    const medicines = transcription.match(medicinePattern) || [];
    const diseases = transcription.match(diseasePattern) || [];

    // Combine relevant details and return
    return {
        medicines: medicines.join(', '),
        diseases: diseases.join(', '),
    };
};

// Function to summarize transcription using GROQ API
const sendSummaryToGROQ = async (summary) => {
    try {
        let response = ''
        const completion = await groq.chat.completions
            .create({
                messages: [
                    {
                        role: "user",
                        content: `Extract medicines , dosage , etc. from this text ${summary} and summarize all of it`,
                    },
                ],
                model: "mixtral-8x7b-32768",
            })
            .then((chatCompletion) => {
                console.log(chatCompletion.choices[0]?.message?.content || "");
                response  = chatCompletion.choices[0]?.message?.content || "";
            });
        return response;
    } catch (error) {
        console.error('Error sending summary to GROQ:', error);
        throw error;
    }
};

// Function to extract text from image using Tesseract.js
const extractTextFromImage = async (imageBuffer) => {
    try {
        console.log('Extracting text from image');
        const worker = await createWorker("eng", 1, { workerPath: "./node_modules/tesseract.js/src/worker-script/node/index.js" });
        await worker.load();
        const { data: { text } } = await worker.recognize(imageBuffer);

        await worker.terminate(); // Clean up the worker
        return text;
    } catch (error) {
        console.error('Error extracting text from image:', error);
        throw error;
    }
};

// Main POST handler
export async function POST(req) {
    const formData = await req.formData();
    const audioFile = formData.get('audio');
    const textInput = formData.get('text');
    const imageFile = formData.get('image'); // Handle image input

    let transcription = '';
    let summary = '';

    // Audio transcription
    if (audioFile) {
        try {
            const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
            transcription = await transcribeAudio(audioBuffer);
        } catch (error) {
            console.error('Error processing audio:', error);
            return NextResponse.json({ error: 'Error processing audio' }, { status: 500 });
        }
    }
    // Text input
    else if (textInput) {
        transcription = textInput;
    }
    // Image processing
    else if (imageFile) {
        try {
            const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
            transcription = await extractTextFromImage(imageBuffer); // Extract text from image
        } catch (error) {
            console.error('Error processing image:', error);
            return NextResponse.json({ error: 'Error processing image' }, { status: 500 });
        }
    } else {
        return NextResponse.json({ error: 'No audio, text, or image input provided' }, { status: 400 });
    }

    // Extract relevant details and summarize
    try {
        summary = await sendSummaryToGROQ(transcription);
        console.log(summary)
    } catch (error) {
        console.error('Error summarizing text:', error);
        return NextResponse.json({ error: 'Error summarizing text' }, { status: 500 });
    }

    return NextResponse.json({ transcription, summary });
}
