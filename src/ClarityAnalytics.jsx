import React, { useEffect } from 'react';

const ClarityAnalytics = ({ clarityProjectId }) => {
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.clarity) {
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.innerHTML = `
        (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window, document, "clarity", "script", "${clarityProjectId}");
      `;
      document.head.appendChild(script);
    }
  }, [clarityProjectId]);

  return null;
};

export default ClarityAnalytics;