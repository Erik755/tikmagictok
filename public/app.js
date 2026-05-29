// public/app.js

document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('loginBtn');
  const trendsList = document.getElementById('trendsList');
  const logBox = document.getElementById('logBox');

  // Add a Sync button dynamically to the Trends section header for better UX
  const trendsHeader = document.querySelector('#trendsSection h2');
  if (trendsHeader) {
    const syncBtn = document.createElement('button');
    syncBtn.id = 'syncBtn';
    syncBtn.className = 'button-secondary';
    syncBtn.innerHTML = '🔄 Sync Trends';
    syncBtn.style.marginLeft = '1rem';
    syncBtn.style.fontSize = '0.9rem';
    syncBtn.style.padding = '0.4rem 0.8rem';
    syncBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    syncBtn.style.color = 'var(--text-primary)';
    syncBtn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
    syncBtn.addEventListener('click', syncTrends);
    trendsHeader.appendChild(syncBtn);
  }

  // Helper: Append logs to the log output panel
  function addLog(text, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    
    let prefix = 'ℹ️';
    if (type === 'success') {
      prefix = '✅';
      entry.style.color = '#00ff66';
    } else if (type === 'error') {
      prefix = '❌';
      entry.style.color = '#ff3366';
    } else if (type === 'warning') {
      prefix = '⚠️';
      entry.style.color = '#ffcc00';
    } else {
      entry.style.color = '#00ffcc';
    }

    const time = new Date().toLocaleTimeString();
    entry.textContent = `[${time}] ${prefix} ${text}`;
    logBox.appendChild(entry);
    logBox.scrollTop = logBox.scrollHeight;
  }

  // 1. Check TikTok Auth Status
  async function checkAuthStatus() {
    const statusPulse = document.getElementById('statusPulse');
    const statusText = document.getElementById('statusText');
    try {
      const response = await fetch('/api/auth/status');
      const data = await response.json();
      
      if (data.authenticated) {
        loginBtn.textContent = `Connected: @${data.username}`;
        loginBtn.classList.remove('button-primary');
        loginBtn.classList.add('button-success');
        loginBtn.style.background = '#00ff66';
        loginBtn.style.color = '#111';
        loginBtn.disabled = true;
        if (statusPulse) statusPulse.classList.add('active');
        if (statusText) statusText.textContent = `Active: @${data.username}`;
        addLog(`TikTok Auth Active (User: @${data.username})`, 'success');
      } else {
        loginBtn.textContent = data.simulated ? 'Conectar (Simulación)' : 'Iniciar sesión TikTok';
        loginBtn.disabled = false;
        if (statusPulse) {
          statusPulse.classList.remove('active');
          statusPulse.style.backgroundColor = 'var(--warning)';
          statusPulse.style.boxShadow = '0 0 8px var(--warning)';
        }
        if (statusText) statusText.textContent = 'Disconnected';
        
        // Remove prior event listeners by cloning button
        const newBtn = loginBtn.cloneNode(true);
        loginBtn.parentNode.replaceChild(newBtn, loginBtn);
        
        newBtn.addEventListener('click', () => {
          addLog('Redirecting to TikTok OAuth...', 'info');
          window.location.href = '/auth/login';
        });
        addLog('TikTok Authentication needed.', 'warning');
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      if (statusPulse) {
        statusPulse.classList.remove('active');
        statusPulse.style.backgroundColor = 'var(--error)';
        statusPulse.style.boxShadow = '0 0 8px var(--error)';
      }
      if (statusText) statusText.textContent = 'Error connecting';
      addLog('Failed to retrieve authentication status from server.', 'error');
    }
  }

  // 2. Load Trends from Database
  async function loadTrends() {
    try {
      trendsList.innerHTML = '<li class="loading">Loading trends...</li>';
      const response = await fetch('/api/trends');
      const trends = await response.json();
      
      trendsList.innerHTML = '';
      if (trends.length === 0) {
        trendsList.innerHTML = '<li class="empty-state">No trends found. Click "Sync Trends" to retrieve.</li>';
        addLog('No trends available in database.', 'warning');
        return;
      }

      trends.forEach(trend => {
        const li = document.createElement('li');
        li.className = 'trend-item log-entry';
        
        const infoDiv = document.createElement('div');
        infoDiv.className = 'trend-info';
        
        const hashtagSpan = document.createElement('span');
        hashtagSpan.className = 'trend-tag';
        hashtagSpan.textContent = `#${trend.hashtag}`;
        hashtagSpan.style.fontWeight = '600';
        hashtagSpan.style.color = 'var(--text-primary)';
        
        const dateSpan = document.createElement('span');
        dateSpan.className = 'trend-date';
        dateSpan.textContent = `Synced: ${new Date(trend.fetchedAt).toLocaleDateString()}`;
        dateSpan.style.display = 'block';
        dateSpan.style.fontSize = '0.75rem';
        dateSpan.style.color = 'var(--text-muted)';
        
        infoDiv.appendChild(hashtagSpan);
        infoDiv.appendChild(dateSpan);

        const actionBtn = document.createElement('button');
        actionBtn.className = 'action-btn';
        actionBtn.innerHTML = '🎬 Generate & Post';
        actionBtn.addEventListener('click', () => generateAndPublish(trend.id, trend.hashtag, actionBtn));

        li.appendChild(infoDiv);
        li.appendChild(actionBtn);
        trendsList.appendChild(li);
      });
      
      addLog(`Loaded ${trends.length} trend(s) from database.`, 'info');
    } catch (error) {
      console.error('Error loading trends:', error);
      trendsList.innerHTML = '<li class="error-state">Failed to load trends.</li>';
      addLog('Failed to retrieve daily trends.', 'error');
    }
  }

  // 3. Manually Sync Trends
  async function syncTrends() {
    addLog('Initiating TikTok Trend Synchronization...', 'info');
    const syncBtn = document.getElementById('syncBtn');
    if (syncBtn) {
      syncBtn.disabled = true;
      syncBtn.textContent = '🔄 Syncing...';
    }

    try {
      const response = await fetch('/api/trends/fetch', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        addLog(`Successfully synchronized ${data.trends.length} new trends!`, 'success');
        await loadTrends();
      } else {
        addLog('Trend synchronization failed.', 'error');
      }
    } catch (error) {
      console.error('Sync error:', error);
      addLog('Error syncing trends with the server.', 'error');
    } finally {
      if (syncBtn) {
        syncBtn.disabled = false;
        syncBtn.textContent = '🔄 Sync Trends';
      }
    }
  }

  // 4. Generate Video and Auto-Publish
  async function generateAndPublish(trendId, hashtag, button) {
    addLog(`Creating custom video for trend #${hashtag}...`, 'info');
    button.disabled = true;
    button.textContent = '⏳ Rendering...';
    button.style.background = '#888';

    try {
      const response = await fetch(`/api/generate-and-publish/${trendId}`, { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        addLog(`Video rendered and uploaded! TikTok Video ID: ${data.tiktokVideoId}`, 'success');
        button.textContent = '✅ Published!';
        button.style.background = '#00ff66';
        button.style.color = '#111';
      } else {
        addLog(`Failed to publish video: ${data.error || 'Server error'}`, 'error');
        button.disabled = false;
        button.textContent = '🎬 Try Again';
        button.style.background = 'var(--accent-start)';
        button.style.color = '#fff';
      }
    } catch (error) {
      console.error('Publish error:', error);
      addLog(`Network error during video processing for #${hashtag}`, 'error');
      button.disabled = false;
      button.textContent = '🎬 Try Again';
      button.style.background = 'var(--accent-start)';
      button.style.color = '#fff';
    }
  }

  // Autopilot simulation control
  const simulationToggle = document.getElementById('simulationToggle');
  const simulationBadge = document.getElementById('simulationBadge');

  async function checkSimulationStatus() {
    try {
      const response = await fetch('/api/simulation/status');
      const data = await response.json();
      
      if (simulationToggle) {
        simulationToggle.checked = data.active;
        updateSimulationUI(data.active);
      }
    } catch (e) {
      console.error('Error checking simulation status:', e);
    }
  }

  function updateSimulationUI(active) {
    if (simulationBadge) {
      if (active) {
        simulationBadge.textContent = 'Activo';
        simulationBadge.className = 'badge-active';
      } else {
        simulationBadge.textContent = 'Inactivo';
        simulationBadge.className = 'badge-inactive';
      }
    }
  }

  if (simulationToggle) {
    simulationToggle.addEventListener('change', async () => {
      const active = simulationToggle.checked;
      addLog(`${active ? 'Iniciando' : 'Deteniendo'} Simulación de Auto-Piloto (30 min)...`, 'info');
      
      try {
        const response = await fetch('/api/simulation/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active })
        });
        const data = await response.json();
        
        if (data.success) {
          updateSimulationUI(data.active);
          addLog(data.message, data.active ? 'success' : 'warning');
        } else {
          addLog('No se pudo cambiar el estado del piloto automático.', 'error');
          simulationToggle.checked = !active;
        }
      } catch (e) {
        console.error('Error toggling simulation:', e);
        addLog('Error de red al alternar el piloto automático.', 'error');
        simulationToggle.checked = !active;
      }
    });
  }

  // Initialize page
  addLog('TikMagicTok Control Panel Initialized.', 'info');
  checkAuthStatus();
  loadTrends();
  checkSimulationStatus();
});

