import React, { useState, useRef } from 'react';
import axios from 'axios';
import { supabase } from './supabaseClient';
import { Paperclip, Send, FileText, Loader, X } from 'lucide-react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL;

function App() {
  const [messages, setMessages] = useState([{ role: 'system', content: 'Hello! Upload multiple files or ask a question.' }]);
  const [input, setInput] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]); // Changed to array
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // 1. Handle Multiple File Selection
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      // Convert FileList to Array and append to existing selection
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (indexToRemove) => {
    setSelectedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const uploadFileWithXHR = (url, file) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url);
  
      xhr.setRequestHeader('Content-Type', file.type);
  
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.response);
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };
  
      xhr.onerror = () => reject(new Error('Network error during upload'));
  
      xhr.send(file);
    });
  };

  // 2. Main Logic Flow
  const handleSend = async () => {
    if (!input && selectedFiles.length === 0) return;

    // Optimistic UI update
    const userMessage = { 
      role: 'user', 
      content: input, 
      files: selectedFiles.map(f => f.name) // Store names for display
    };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    
    // Clear selection immediately from UI (we keep a copy for upload)
    const filesToUpload = [...selectedFiles];
    setSelectedFiles([]);
    
    let uploadedFileIds = [];

    try {
      if (filesToUpload.length > 0) {
        setIsUploading(true);
        
        // A. Get Batch Presigned URLs
        const metadata = filesToUpload.map(f => ({ file_name: f.name, file_type: f.type }));
        const { data: presignedList } = await axios.post(`${API_URL}/generate-presigned-urls`, {
          files: metadata
        });

        // B. Upload All to S3 in Parallel
        // const uploadPromises = presignedList.map((item, index) => {

        //   console.log(item.url);
        //   const file = filesToUpload[index];
        //   return axios.put(item.url, file, {
        //     headers: { 'Content-Type': file.type }
        //   });
        // });

        // await Promise.all(uploadPromises);

        // B. Upload All to S3 in Parallel (using XHR)
        const uploadPromises = presignedList.map((item, index) => {
          console.log(item.url);
          const file = filesToUpload[index];
          return uploadFileWithXHR(item.url, file);
        });

        await Promise.all(uploadPromises);

        // C. Batch Insert into Supabase
        const dbRows = presignedList.map(item => ({
          file_name: item.original_name,
          file_type: item.type,
          s3_key: item.key
                }));

        const { data: dbData, error } = await supabase
          .from('files')
          .insert(dbRows)
          .select(); // Returns the inserted rows with IDs

        if (error) throw error;
        uploadedFileIds = dbData.map(row => row.id);
        setIsUploading(false);
      }

      // D. Send Query to Backend
      const { data: chatResponse } = await axios.post(`${API_URL}/chat`, {
        message: userMessage.content,
        file_ids: uploadedFileIds
      });

      setMessages(prev => [...prev, { role: 'bot', content: chatResponse.response }]);

    } catch (error) {
      console.error("Error:", error);
      setMessages(prev => [...prev, { role: 'bot', content: "Error uploading files." }]);
      setIsUploading(false);
    }
  };

  return (
    <div className="chat-container">
      <header className="chat-header">
        <h1>Multi-File Chat</h1>
      </header>

      <div className="messages-list">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.role}`}>
            <div className="message-content">
              {/* Render attached files as badges */}
              {msg.files && msg.files.length > 0 && (
                <div className="file-grid">
                  {msg.files.map((fname, i) => (
                    <div key={i} className="file-attachment">
                      <FileText size={14} />
                      <span className="filename">{fname}</span>
                    </div>
                  ))}
                </div>
              )}
              <p>{msg.content}</p>
            </div>
          </div>
        ))}
        {isUploading && <div className="message system"><Loader className="spin"/> Uploading {selectedFiles.length} files...</div>}
      </div>

      <div className="input-area">
        {/* File Preview Area */}
        {selectedFiles.length > 0 && (
           <div className="file-preview-container">
             {selectedFiles.map((f, i) => (
               <div key={i} className="file-preview-badge">
                 <span>{f.name}</span>
                 <button onClick={() => removeFile(i)}><X size={12}/></button>
               </div>
             ))}
           </div>
        )}
        
        <div className="controls">
          <input 
            type="file" 
            multiple  // <--- KEY CHANGE
            ref={fileInputRef} 
            onChange={handleFileChange} 
            style={{display: 'none'}} 
          />
          <button className="icon-btn" onClick={() => fileInputRef.current.click()}>
            <Paperclip size={20} />
          </button>
          
          <input 
            type="text" 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="Type a message..."
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          
          <button className="send-btn" onClick={handleSend} disabled={isUploading}>
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;