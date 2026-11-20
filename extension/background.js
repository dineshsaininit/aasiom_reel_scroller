chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type === 'shot') {
    chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'jpeg', quality: 60 })
      .then(d => reply({ data: d.split(',')[1] })).catch(e => reply({ error: e.message }));
    return true;
  }
  if (msg.type === 'analyze') {
    fetch('http://localhost:3000/api/analyze', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(msg.payload),
    }).then(r => r.json()).then(reply).catch(e => reply({ error: e.message }));
    return true;
  }
});
