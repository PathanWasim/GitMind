import { useEffect, useRef, useState } from 'react';

export function useEventSource(url, options = {}) {
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);

  useEffect(() => {
    if (!url) {
      return undefined;
    }

    const eventSource = new EventSource(url, options);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      setMessages((currentMessages) => [...currentMessages, event.data]);
    };

    eventSource.onerror = (event) => {
      setError(event);
      eventSource.close();
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [url]);

  return { messages, error, eventSource: eventSourceRef.current };
}
