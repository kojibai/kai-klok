export function requestKairosNotifications() {
    if (!('Notification' in window)) return;
  
    Notification.requestPermission().then((perm) => {
      if (perm === 'granted') {
        scheduleKairosBeat();
      }
    });
  }
  
  function scheduleKairosBeat() {
    const kaiPulse = 5.236; // seconds
    const beatLength = 484 * kaiPulse * 1000;
  
    setTimeout(() => {
      new Notification("🌬 Kairos Beat", {
        body: "You’ve entered a new Beat. Breathe. Align.",
      });
  
      scheduleKairosBeat(); // loop
    }, beatLength);
  }
  