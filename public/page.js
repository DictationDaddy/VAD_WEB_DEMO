'use client';

import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import './onboarding.css';
import listeningIcon from './extension-icons/logo-listening.png';
import idleIcon from './extension-icons/logo-128.png';
import errorIcon from './extension-icons/logo-error.png';
import thinkingIcon from './extension-icons/logo-thinking.png';

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
  const [showIcon, setShowIcon] = useState(false);

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
    
    if (['listening', 'thinking', 'idle', 'error'].includes(state)) {
      setShowIcon(true);
      setTimeout(() => setShowIcon(false), 5000);
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

  const getIconPath = (state) => {
    switch (state) {
      case 'listening':
        return listeningIcon;
      case 'idle':
          return idleIcon;
      case 'error':
        return errorIcon;
      case 'thinking':
        return thinkingIcon;
      default:
        return idleIcon;
    }
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
        width: '80%',
        maxWidth: '800px',
        margin: '0 auto',
        padding: '2rem',
        textAlign: 'center',
        position: 'relative',
        color: '#000000',
        borderRadius: '10px',
      }}>
        <h1 style={{ 
          marginBottom: '2rem', 
          color: 'black', 
          marginTop: '2rem', 
          fontSize: '2.5em', 
          fontWeight: 'bold',
          textShadow: '2px 2px 4px rgba(0,0,0,0.1)'
        }}>
          Dictation Daddy Demo
        </h1>
        <div style={{
          backgroundColor: '#fff',
          padding: '1rem',
          borderRadius: '10px',
          boxShadow: '0 0 10px rgba(0,0,0,0.1)',
          marginBottom: '2rem'
        }}>
          <textarea
            ref={textAreaRef}
            placeholder="Click here to start"
            onClick={handleTextAreaClick}
            style={{
              width: '100%',
              padding: '15px',
              color: '#000000',
              height: '150px',
              caretColor: '#000000',
              outline: 'none',
              fontFamily: "'Kalam', cursive",
              backgroundColor: 'transparent',
              fontSize: '1.5rem',
              border: '2px solid #8B4513',
              borderRadius: '5px',
              resize: 'vertical',
            }}
          ></textarea>
        </div>
        <div style={{
          backgroundColor: '#fff',
          padding: '1rem',
          borderRadius: '10px',
          boxShadow: '0 0 10px rgba(0,0,0,0.1)',
          marginBottom: '2rem'
        }}>
          <p style={{ 
            fontSize: '1.5rem', 
            color: '#8B4513', 
            fontWeight: 'bold' 
          }}>
            {message}
          </p>
        </div>
        {state !== '' && (
          <div style={{
            backgroundColor: '#e6ccb3',
            padding: '1rem',
            borderRadius: '10px',
            boxShadow: '0 0 10px rgba(0,0,0,0.1)',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {showIcon && (
              <img 
                src={getIconPath(state)} 
                alt={`${state} icon`} 
                style={{
                  width: '24px',
                  height: '24px',
                  marginRight: '10px'
                }}
              />
            )}
            <p style={{ 
              fontSize: '1.5rem', 
              color: '#8B4513'
            }}>
              Current state: <span style={{ fontWeight: 'bold' }}>{state}</span>
            </p>
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
