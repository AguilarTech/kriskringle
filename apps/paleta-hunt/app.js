const app = document.querySelector('#app')
const config = window.huntConfig
const flavours = ['blueberry', 'chocolate', 'hibiscus', 'lemon', 'lime', 'mandarin', 'mango', 'margarita', 'mojito', 'orange', 'raspberry', 'strawberry', 'watermelon', 'kiwifruit', 'horchata', 'screwdriver', 'kulfi', 'melon']
let step = 0
let flavour = 'mango'
let stream

// Configuration is organiser-written; display clue text as text, not HTML.
function text(id, value) { document.querySelector(id).textContent = value }
function stopCamera() {
  stream?.getTracks().forEach(track => track.stop())
  stream = undefined
}
function start() {
  stopCamera()
  app.innerHTML = `<div class="intro"><p class="eyebrow">A scavenger hunt for your secret santa</p><h1>A little walk.<br><em>A sweet surprise.</em></h1><p>Follow the clues, find the final spot and discover your paleta.</p><div class="note"><strong>Prototype mode</strong><br>Choose a sample flavour to try the experience. This is not connected to the Kris Kringle draw yet.</div><label for="flavour">Your sample flavour</label><select id="flavour"></select><button id="begin">Let's go <span>→</span></button></div>`
  const select = document.querySelector('#flavour')
  flavours.forEach(name => select.add(new Option(name[0].toUpperCase() + name.slice(1), name)))
  select.value = flavour
  document.querySelector('#begin').onclick = () => { flavour = select.value; step = 0; showClue() }
}
function showClue() {
  const item = config.clues[step]
  app.innerHTML = `<div class="progress">CLUE <span id="number"></span> OF <span id="total"></span></div><div class="clue-card"><span class="clue-icon" aria-hidden="true">✳</span><p class="eyebrow">Look around</p><h1 id="clue"></h1><form id="answer-form"><label for="answer">Your answer</label><input id="answer" autocomplete="off" required placeholder="Type your answer"><p id="feedback" class="feedback" role="status"></p><button>Check answer <span>→</span></button></form><button class="text-button" id="hint-button" type="button">Need a hint?</button><p id="hint" class="hint"></p></div>`
  text('#number', step + 1); text('#total', config.clues.length); text('#clue', item.clue)
  document.querySelector('#hint-button').onclick = () => text('#hint', item.hint)
  document.querySelector('#answer-form').onsubmit = event => {
    event.preventDefault()
    if (document.querySelector('#answer').value.trim().toLowerCase() !== item.answer.trim().toLowerCase()) { text('#feedback', 'Not quite. Have another look!'); return }
    step++
    if (step < config.clues.length) showClue(); else checkpoint()
  }
}
function distanceMetres(a, b) {
  const radians = degrees => degrees * Math.PI / 180
  const dLat = radians(b.latitude - a.latitude), dLon = radians(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}
function checkpoint() {
  app.innerHTML = `<div class="finish-card"><p class="eyebrow">The final stop</p><h1>You're so close.</h1><p id="location-copy"></p><div class="pin" aria-hidden="true">✳</div><p id="location-status" class="feedback" role="status"></p><button id="location-button"></button><button class="text-button" id="restart" type="button">Start again</button></div>`
  const button = document.querySelector('#location-button')
  document.querySelector('#restart').onclick = start
  if (!config.location) {
    text('#location-copy', 'The final location has not been set yet. Continue to try the reveal.')
    button.textContent = 'Try the reveal →'; button.onclick = reveal; return
  }
  text('#location-copy', 'Head to the final spot, then check your location to unlock your surprise.')
  button.textContent = 'Check my location →'
  button.onclick = () => {
    if (!navigator.geolocation) { text('#location-status', 'Location is unavailable on this device.'); return }
    button.disabled = true; text('#location-status', 'Finding your location…')
    navigator.geolocation.getCurrentPosition(position => {
      button.disabled = false
      const distance = distanceMetres(position.coords, config.location)
      if (distance <= config.location.radiusMetres) { reveal(); return }
      text('#location-status', `About ${Math.round(distance)} metres from the final spot. Move closer and try again.`)
    }, () => { button.disabled = false; text('#location-status', 'Could not get your location. Check your browser permissions and try again.') }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
  }
}
function reveal() {
  app.innerHTML = `<div class="reveal"><p class="eyebrow">You found it</p><h1>Meet your paleta.</h1><p>Point your camera at the final spot for your surprise.</p><div class="camera"><video id="video" autoplay playsinline muted></video><div class="camera-message" id="camera-message">Your paleta is ready!</div><div class="paleta"><img id="art" alt=""><strong id="name"></strong><span>YOUR PALETA</span></div></div><p id="camera-status" class="camera-status" role="status">Turn on your camera to see the reveal over the live view.</p><button id="camera-button">Open camera <span>→</span></button><button id="again" class="text-button" type="button">Play again</button></div>`
  const name = flavour[0].toUpperCase() + flavour.slice(1)
  const art = document.querySelector('#art'); art.src = `paletas/${flavour}.webp`; art.alt = `${name} paleta`
  text('#name', name)
  document.querySelector('#again').onclick = start
  document.querySelector('#camera-button').onclick = async event => {
    const button = event.currentTarget
    if (!navigator.mediaDevices?.getUserMedia) { text('#camera-status', 'Camera unavailable. You can still enjoy your paleta above.'); return }
    button.disabled = true
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      document.querySelector('#video').srcObject = stream
      document.querySelector('#camera-message').hidden = true
      text('#camera-status', 'Your paleta is overlaid on the camera view.')
      button.hidden = true
    } catch { text('#camera-status', 'Camera access was unavailable. Your paleta is still here to enjoy.'); button.disabled = false }
  }
}
window.addEventListener('pagehide', stopCamera)
start()
