// src/App.tsx

import React, { useState } from 'react';
import axios from 'axios';

interface Message {
  sender: 'user' | 'bot';
  content: string;
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSend = async () => {
    if (input.trim() === '' && !file) return;

    const newMessage: Message = { sender: 'user', content: input };
    setMessages((prev) => [...prev, newMessage]);
    setInput('');
    setLoading(true);

    const formData = new FormData();
    formData.append('message', input);
    if (file) {
      formData.append('file', file);
    }

    try {
      const response = await axios.post('http://localhost:5001/api/chat', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const botMessage: Message = { sender: 'bot', content: response.data.message };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error(error);
      const errorMessage: Message = { sender: 'bot', content: 'Sorry, something went wrong.' };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setFile(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <header className="bg-blue-600 text-white p-4 text-center text-2xl">
        Chat with Fee - SESMag
      </header>
      <div className="flex-1 p-4 overflow-y-auto">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`mb-4 flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`rounded-lg p-2 max-w-md ${
                msg.sender === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-800'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="mb-4 flex justify-start">
            <div className="rounded-lg p-2 bg-gray-300 text-gray-800">Fee is typing...</div>
          </div>
        )}
      </div>
      <footer className="p-4 bg-white flex items-center">
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="mr-2"
        />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 border border-gray-300 rounded-md p-2 mr-2"
        />
        <button
          onClick={handleSend}
          className="bg-blue-600 text-white px-4 py-2 rounded-md"
          disabled={loading}
        >
          Send
        </button>
      </footer>
    </div>
  );
};

export default App;