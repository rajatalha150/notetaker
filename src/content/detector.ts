const url = window.location.href;
let platform: string | undefined;

if (url.includes("meet.google.com")) platform = "Google Meet";
else if (url.includes("zoom.us")) platform = "Zoom";
else if (url.includes("teams.microsoft.com")) platform = "Microsoft Teams";
else if (url.includes("teams.live.com")) platform = "Microsoft Teams";

if (platform) {
  // 1. Initial platform detection
  chrome.runtime.sendMessage({
    type: "PLATFORM_DETECTED",
    platform,
  });

  // 2. Continuous Speaker Tracking
  let trackingInterval: number | undefined;
  
  const startTracking = () => {
    if (trackingInterval) return;
    
    trackingInterval = window.setInterval(() => {
      let activeSpeaker: string | undefined;
      let myName: string | undefined;

      if (platform === "Google Meet") {
        myName = document.querySelector('[data-self-name]')?.textContent || undefined;
        
        const speakingElement = document.querySelector('[data-is-speaking="true"]');
        if (speakingElement) {
          activeSpeaker = speakingElement.getAttribute('data-name') || 
                          speakingElement.querySelector('[data-self-name]')?.textContent ||
                          undefined;
        }
        
        if (!activeSpeaker) {
          const visualizer = document.querySelector('.Zf0Zje, .VfPpkd-Bz112c-LgbsSe');
          const container = visualizer?.closest('[data-participant-id]');
          if (container) {
            activeSpeaker = container.querySelector('[data-self-name]')?.textContent || 
                            container.querySelector('.display-name')?.textContent || 
                            undefined;
          }
        }
      }

      else if (platform === "Microsoft Teams") {
        // Self name in Teams
        myName = document.querySelector('[data-tid="self-name"]')?.textContent || 
                 document.querySelector('.self-name')?.textContent || 
                 undefined;

        // Active speaker in Teams
        // Teams adds a "speaking" class or attribute to the participant tile
        const activeTile = document.querySelector('.ui-chat__item--speaking, [data-tid="active-speaker-tile"]');
        if (activeTile) {
          activeSpeaker = activeTile.querySelector('[data-tid="participant-name"]')?.textContent || 
                          activeTile.querySelector('.ui-chat__item__header__name')?.textContent || 
                          undefined;
        }

        // Alternative for newer grid view
        if (!activeSpeaker) {
          const activeIndicator = document.querySelector('.is-speaking, .speaking-indicator-active');
          const container = activeIndicator?.closest('.f-grid-cell, .participant-tile');
          if (container) {
            activeSpeaker = container.querySelector('.participant-name')?.textContent || undefined;
          }
        }
      }

      else if (platform === "Zoom") {
        // Zoom Web Client selectors
        myName = document.querySelector('.me-view .name-label')?.textContent || 
                 document.querySelector('.self-participant-name')?.textContent || 
                 undefined;

        // Active speaker - Zoom usually highlights the name label or tile border
        const activeLabel = document.querySelector('.active-speaker .name-label, .speaker-highlight .name-label');
        if (activeLabel) {
          activeSpeaker = activeLabel.textContent || undefined;
        }

        if (!activeSpeaker) {
          const speakerTile = document.querySelector('.speaker-view .active-video-container');
          activeSpeaker = speakerTile?.querySelector('.name-label')?.textContent || undefined;
        }
      }

      if (myName) {
        chrome.runtime.sendMessage({ type: "USER_NAME_DETECTED", name: myName.trim() });
      }

      if (activeSpeaker) {
        chrome.runtime.sendMessage({
          type: "SPEAKER_ACTIVE",
          name: activeSpeaker.trim()
        });
      }
    }, 2000);
  };

  startTracking();
}

export {};
