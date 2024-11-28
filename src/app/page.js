'use client';
import React, { useState, useRef } from 'react';
import axios from 'axios';

const VoiceRecorder = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [transcription, setTranscription] = useState('');
    const [summary, setSummary] = useState('');
    const [audioURL, setAudioURL] = useState('');
    const [textInput, setTextInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [imageFile, setImageFile] = useState(null); // New state for image file
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);


    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            mediaRecorderRef.current.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };
            mediaRecorderRef.current.onstop = handleStopRecording;
            audioChunksRef.current = [];
            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Error accessing microphone:", err);
        }
    };

    const stopRecording = () => {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
    };

    const handleStopRecording = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setAudioURL(audioUrl);

        const formData = new FormData();
        formData.append('audio', audioBlob);

        setLoading(true); // Set loading state to true

        axios.post('/api/transcribe', formData)
            .then((response) => {
                setTranscription(response.data.transcription);
                setSummary(response.data.summary);
            })
            .catch((err) => {
                console.error("Error sending audio data to server:", err);
            })
            .finally(() => {
                setLoading(false); // Set loading state to false regardless of success or failure
            });
    };

    const handleTextSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('text', textInput);

        setLoading(true);

        axios.post('/api/transcribe', formData)
            .then((response) => {
                setTranscription(response.data.transcription);
                setSummary(response.data.summary);
                setTextInput('');
            })
            .catch((err) => {
                console.error("Error sending text data to server:", err);
            })
            .finally(() => {
                setLoading(false);
            });
    };

    const handleImageUpload = (e) => {
        setImageFile(e.target.files[0]);
    };

    const handleImageSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('image', imageFile);

        setLoading(true);

        axios.post('/api/transcribe', formData)
            .then((response) => {
                setTranscription(response.data.transcription);
                setSummary(response.data.summary);
                setImageFile(null); // Clear image file after submission
            })
            .catch((err) => {
                console.error("Error sending image data to server:", err);
            })
            .finally(() => {
                setLoading(false);
            });
    };

    return (
        <div className="max-w-2xl mx-auto p-6 bg-slate-700 shadow-lg rounded-lg">
            <h1 className="text-2xl font-bold text-center mb-4">Real-Time Summarization with Voice</h1>

            <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-full h-12 mb-4 flex items-center justify-center text-white font-semibold rounded-lg transition-colors duration-300 ${isRecording ? 'bg-red-600' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
                {isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>

            {audioURL && (
                <div className="mb-4">
                    <h2 className="text-xl font-semibold">Recorded Audio:</h2>
                    <audio src={audioURL} controls className="w-full mt-2" />
                </div>
            )}

            <h2 className="text-xl font-semibold">Transcription:</h2>
            <p className="border p-2 mb-4 rounded-lg bg-gray-500">{transcription || 'No transcription available.'}</p>

            <h2 className="text-xl font-semibold">Summary:</h2>
            <div className="border p-2 mb-4 rounded-lg bg-gray-500" dangerouslySetInnerHTML={{ __html: summary || 'No summary available.' }} />

            {loading && (
                <div className="flex items-center justify-center mb-4">
                    <svg
                        className="animate-spin h-8 w-8 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                </div>
            )}

            <h2 className="text-xl font-semibold mb-2">Or Enter Text Directly:</h2>
            <form onSubmit={handleTextSubmit} className="mb-4">
                <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    rows="4"
                    cols="50"
                    placeholder="Type your text here..."
                    required
                    className="w-full p-2 border rounded-lg bg-gray-500 text-white placeholder:text-white focus:outline-none"
                />
                <button
                    type="submit"
                    className="w-full h-12 mt-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors duration-300"
                >
                    Submit Text
                </button>
            </form>

            <h2 className="text-xl font-semibold mb-2">Or Upload an Image Prescription:</h2>
            <form onSubmit={handleImageSubmit} className="mb-4">
                <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    required
                    className="w-full mb-2"
                />
                <button
                    type="submit"
                    className="w-full h-12 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors duration-300"
                >
                    Submit Image
                </button>
            </form>
        </div>
    );
};

export default VoiceRecorder;


