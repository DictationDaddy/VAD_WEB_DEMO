'use client';
import { useState, useEffect } from 'react';
import { GoogleAuthProvider, signInWithRedirect } from 'firebase/auth';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import GoogleIcon from './google-icon.svg';
import './login.css';

const firebaseConfig = {
  apiKey: 'AIzaSyBB61A74ubYBjO5UiIB60tpI8JdgdKRRNM',
  authDomain: 'dictationdaddy.firebaseapp.com',
  projectId: 'dictationdaddy',
  storageBucket: 'dictationdaddy.appspot.com',
  messagingSenderId: '535381141921',
  appId: '1:535381141921:web:5cefab847a4d12ba6103e0',
  measurementId: 'G-08X5FW24N4',
};

// Modified initialization to include Functions
let auth = null;
let functions = null;

const initializeFirebase = () => {
  if (auth) return { auth, functions };
  
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    functions = getFunctions(app);
    
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        console.log("Persistence set to LOCAL");
      })
      .catch((error) => {
        console.error("Persistence error:", error);
      });
    
    return { auth, functions };
  } catch (error) {
    console.error("Firebase initialization error:", error);
    throw error;
  }
};

export default function Login() {
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [customToken, setCustomToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    const { auth } = initializeFirebase();
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          setIsLoading(true);
          const { functions } = initializeFirebase();
          const getCustomToken = httpsCallable(functions, 'generateCustomToken');
          const idToken = await user.getIdToken();
          const result = await getCustomToken({
            idToken: idToken
          });
          setCustomToken(result.data);
          setUser({
            name: user.displayName,
            email: user.email
          });
        } catch (error) {
          console.error('Custom token error:', error);
          setError('Failed to get authentication token.');
        } finally {
          setIsLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const handleCopyToken = async () => {
    try {
      await navigator.clipboard.writeText(customToken);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    } catch (err) {
      console.error('Failed to copy token:', err);
      setError('Failed to copy token to clipboard');
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const { auth } = initializeFirebase();
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      
      provider.setCustomParameters({
        prompt: 'select_account'
      });

      await signInWithRedirect(auth, provider);
    } catch (error) {
      console.error("Sign in error:", error);
      setError('Failed to sign in with Google. Please try again.');
    }
  };

  return (
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
        Sign in to Dictation Daddy
      </h1>

      <div style={{
        backgroundColor: '#fff',
        padding: '2rem',
        borderRadius: '10px',
        boxShadow: '0 0 10px rgba(0,0,0,0.1)',
        marginBottom: '2rem'
      }}>
        {error && (
          <div style={{
            backgroundColor: '#ffebee',
            color: '#c62828',
            padding: '1rem',
            borderRadius: '5px',
            marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}

        {user ? (
          <div style={{
            backgroundColor: '#e8f5e9',
            padding: '2rem',
            borderRadius: '10px',
            textAlign: 'center'
          }}>
            <h2 style={{ marginBottom: '1rem' }}>Successfully Logged In!</h2>
            <p>Welcome, {user.name}</p>
            
            {isLoading ? (
              <div style={{ margin: '2rem 0' }}>
                Generating authentication token...
              </div>
            ) : (
              <div style={{
                margin: '2rem 0',
                padding: '1.5rem',
                backgroundColor: '#f5f5f5',
                borderRadius: '8px',
                border: '1px solid #ddd'
              }}>
                <p style={{ marginBottom: '1rem', fontWeight: 'bold' }}>
                  Please copy this authentication token and paste it into your desktop application:
                </p>
                
                <div style={{
                  position: 'relative',
                  marginBottom: '1rem'
                }}>
                  <input
                    type="text"
                    readOnly
                    value={customToken}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '4px',
                      border: '1px solid #ccc',
                      backgroundColor: '#fff',
                      fontSize: '14px',
                      fontFamily: 'monospace'
                    }}
                  />
                  <button
                    onClick={handleCopyToken}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      padding: '6px 12px',
                      backgroundColor: copySuccess ? '#4CAF50' : '#2196F3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    {copySuccess ? 'Copied!' : 'Copy Token'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={handleGoogleSignIn}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              width: '100%',
              padding: '12px 24px',
              backgroundColor: '#e6ccb3',
              color: '#8B4513',
              border: '2px solid #8B4513',
              borderRadius: '5px',
              fontSize: '1.2rem',
              fontFamily: "'Kalam', cursive",
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#d4b89f'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#e6ccb3'}
          >
            <img
              src={GoogleIcon.src}
              alt="Google logo"
              style={{
                width: '24px',
                height: '24px'
              }}
            />
            Sign in with Google
          </button>
        )}
      </div>
    </div>
  );
}