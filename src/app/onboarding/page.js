'use client';

import React, { useState, useEffect, useRef } from 'react';


function getState(eventType){
  switch (eventType){
    case "START_LISTENING":
    case "RECORDING_STARTED":
      return "listening"
    case "STOP_LISTENING":
    case "RECORDING_STOPPED":
      return "thinking"
    case "TRANSCRIPTION_RECIEVED":
      return "idle"
    case "error":
      return "error"
    case "AUDIO_OFFSCREEN_READY":
      return "NONE"
  }
  return 'idle'
}



const sendMessageToExtension = (message, callback) => {
  if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage('kiojkgijidmhejbhdjbcklelfabkgboi', message, function(response) {
      console.log('Response from extension:', response);
      callback(response);
    });
  } else {
    console.error('Chrome runtime not available');
  }
};

const sendMessageToContentScriptInCurrentTab = (message) => {
  if (window && window.postMessage) {
    window.postMessage(message, '*');
  } else {
    console.error('Window postMessage not available');
  }
};

function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState('');
  const [shortcuts, setShortcuts] = useState([]);
  const [state, setState] = useState('');
  const textAreaRef = useRef(null);

  useEffect(() => {
    // Get shortcuts from extension when component mounts
    sendMessageToExtension({
      eventType: 'GET_SHORTCUTS',
    }, (response) => {
      console.log(response);
      setShortcuts(response.shortcuts);
    });
  }, []);

  useEffect(() => {
    // Event listener for messages from content script
    const handleMessageFromContentScript = (event) => {
      if (event.data && event.data.type === 'GET_STATE_RESPONSE') {
        console.log('Response from content script:', event.data);
        const state = getState(event.data.response);
        setState(state);
      }
    };

    // Add listener only once
    window.addEventListener('message', handleMessageFromContentScript);

    // Periodically send a message to the content script to get state
    const intervalId = setInterval(() => {
      console.log('Getting state from content script');
      sendMessageToContentScriptInCurrentTab({
        type: 'GET_STATE',
      });
    }, 1000);

    // Cleanup: Remove event listener and interval when component unmounts
    return () => {
      window.removeEventListener('message', handleMessageFromContentScript);
      clearInterval(intervalId);
    };
  }, []);

  const handleTextAreaClick = () => {
    if (step === 0) {
      setStep(1);
      setTimeout(() => {
        setMessage(`Press the ${shortcuts} to start listening`);
      }, 100);
    }

    // Focus the textarea after DOM update
    setTimeout(() => {
      if (textAreaRef.current) {
        textAreaRef.current.focus();
      }
    }, 10); 
  };

  return (
    <div style={{
      width: '70%',
      marginLeft: 'auto',
      marginRight: 'auto',
      textAlign: 'center',
    }}>
      <h1>DictationDaddy Demo</h1>
      <textarea
        ref={textAreaRef}
        placeholder="Click here to begin"
        onClick={handleTextAreaClick}
        style={{
          width: '100%',
          padding: '10px',
          color: 'black',
          height: '100px',
          caretColor: 'black',
          outline: 'none',
        }}
      ></textarea>
      <p>{message}</p>
      <p>{state}</p>
    </div>
  );
}

export default OnboardingPage;
