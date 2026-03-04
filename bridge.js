// bridge.js — MAIN world で動作
// mux-player の timeupdate を content script に postMessage で中継する
(function () {
  const TOKEN = String(Math.random()).slice(2);

  function attachToPlayer(player) {
    player.dataset.muxBridgeToken = TOKEN;
    ['timeupdate', 'seeked', 'loadedmetadata'].forEach((type) => {
      player.addEventListener(type, (e) => {
        window.postMessage(
          { __muxSubtitle: true, token: TOKEN, currentTime: e.target.currentTime },
          '*'
        );
      });
    });
  }

  const existing = document.querySelector('mux-player');
  if (existing) {
    attachToPlayer(existing);
    return;
  }

  const observer = new MutationObserver(() => {
    const player = document.querySelector('mux-player');
    if (player) {
      observer.disconnect();
      attachToPlayer(player);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
