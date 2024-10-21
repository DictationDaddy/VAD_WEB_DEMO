import mixpanel from 'mixpanel-browser';

const sessionId = Date.now().toString();

try {
  mixpanel.init('1e8a59b7f3eddaf1e6e6b9dceb69965e', {
    api_host: 'https://api.mixpanel.com',
    persistence: 'localStorage',
  });

  mixpanel.register({
    $session_id: sessionId,
  });

} catch (error) {
  console.error('Mixpanel initialization failed:', error);
}
// Get extension version from manifest



export const trackEvent = (uid: string, eventName: string, properties = {}) => {
  if (uid) {
    mixpanel.alias(uid);
    mixpanel.identify(uid);
  }
  mixpanel.track(eventName, {
    ...properties,
    session_id: sessionId,
  });
};


export const EVENTS = {
  DEMO_OPENED: 'DEMO_OPENED_WEB',
  DEMO_COMPLETED: 'DEMO_COMPLETED_WEB',
};

export const getSessionId = () => {
  return sessionId;
};

export const mixpanelDD = mixpanel