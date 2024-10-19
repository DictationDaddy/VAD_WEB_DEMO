'use client';

import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import './onboarding.css';

function getState(eventType) {
  switch (eventType) {
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
  const [showArrow, setShowArrow] = useState(false);

  useEffect(() => {
    sendMessageToExtension({
      eventType: 'GET_SHORTCUTS',
    }, (response) => {
      console.log(response);
      setShortcuts(response.shortcuts);
    });
  }, []);

  useEffect(() => {
    const handleMessageFromContentScript = (event) => {
      if (event.data && event.data.type === 'GET_STATE_RESPONSE') {
        console.log('Response from content script:', event.data);
        const newState = getState(event.data.response);
        setState(newState);
      }
    };

    window.addEventListener('message', handleMessageFromContentScript);

    const intervalId = setInterval(() => {
      console.log('Getting state from content script');
      sendMessageToContentScriptInCurrentTab({
        type: 'GET_STATE',
      });
    }, 1000);

    return () => {
      window.removeEventListener('message', handleMessageFromContentScript);
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    console.log("State is ", state);
    handleStateChange(state);
    
    // Show the arrow when state changes to listening, thinking, or idle
    if (['listening', 'thinking', 'idle'].includes(state)) {
      setShowArrow(true);
      // Hide the arrow after 5 seconds
      setTimeout(() => setShowArrow(false), 5000);
    }
  }, [state]);

  const handleStateChange = (newState) => {
    switch (newState) {
      case 'listening':
        setMessage('Notice the listening icon change on the Chrome extension bar. Notice the sound.');
        setTimeout(() => {
          setMessage('Speak "Marry had a little lamb."');
          setTimeout(() => {
            setMessage(`Press the ${shortcuts} again to transcribe.`);
          }, 3000);
        }, 4000);
        break;
      case 'thinking':
        setMessage('Notice the change in the extension icon and the sound.');
        break;
      case 'idle':
        setMessage('Transcription received. Notice that the text is inserted into the text area.');
        break;
      case 'error':
        setMessage('Error occurred. Please try again.');
        break;
    }
  };

  const handleTextAreaClick = () => {
    if (step === 0) {
      setStep(1);
      setMessage(`Press ${shortcuts} to begin.`);
    }

    setTimeout(() => {
      if (textAreaRef.current) {
        textAreaRef.current.focus();
      }
    }, 10);
  };

  return (
    <>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Kalam:wght@300;400;700&display=swap" rel="stylesheet" />
      </Head>
      <div style={{
        fontFamily: "'Kalam', cursive",
        backgroundColor: '#f5e6d3',
        minHeight: '100vh',
        width: '70%',
        marginLeft: 'auto',
        marginRight: 'auto',
        textAlign: 'center',
        position: 'relative',
        color: '#000000',  // Updated to black
      }}>
        <h1 style={{ marginBottom: '2rem', color:'black', marginTop: '2rem', fontSize: '2em', fontWeight: 'bold' }}>Dictation Demo</h1>
        <textarea
          ref={textAreaRef}
          placeholder="Click here to start"
          onClick={handleTextAreaClick}
          style={{
            width: '80%',
            padding: '10px',
            color: '#000000',  // Updated to black
            height: '100px',
            caretColor: '#000000',  // Updated to black
            outline: 'none',
            fontFamily: "'Kalam', cursive",
            backgroundColor: 'white',
            fontSize: '1.5rem',
            border: '1px solid #8B4513',
            borderRadius: '5px',
          }}
        ></textarea>
        <p style={{ fontSize: '1.5rem' }}>{message}</p>
        { state !== '' && <p style={{ fontSize: '1.5rem' }}>Current state: {state}</p>}
        {showArrow && (
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '-50px',
            fontSize: '24px',
            animation: 'bounce 0.5s infinite alternate',
          }}>
            ↗️
          </div>
        )}
        <style jsx>{`
          @keyframes bounce {
            from { transform: translateY(0px); }
            to { transform: translateY(-10px); }
          }
        `}</style>
      </div>
    </>
  );
}

export default OnboardingPage;
