# Paleta Hunt prototype

A small, standalone browser scavenger hunt. It uses sample flavours and is **not connected to the Kris Kringle draw**. The camera reveal is a picture over a live camera view; it does not track a physical object or stay anchored in the world.

## Try it

Copy `config.example.js` to `config.js` first. From this directory, run `python -m http.server 8000`, then open `http://localhost:8000` on the same computer. For camera and location on phones, serve the folder over HTTPS (for example, deploy it as a separate static site). Open it in Safari on iPhone or Chrome on Android. Location and camera permissions are requested only when needed. The reveal still works as a picture if the camera is unavailable.

## Set up the hunt

Edit `config.js` to replace the example clues, answers and hints. Set `location` to the final checkpoint, for example:

```js
location: { latitude: -37.81, longitude: 144.96, radiusMetres: 50 },
```

The coordinates above are examples, not a real hunt location. With `location: null`, the checkpoint is skipped so the prototype can be tried anywhere. Test the radius on the actual phones at the location: GPS can drift. The checkpoint is checked in the browser only while the page is open; it is not a background geofence. `config.js` is ignored by Git, so supply it separately when deploying. Once deployed, its clues, answers and location are visible to anyone who can access the site; Git ignore does not make them secret from players.

The player selects a sample flavour at the start. Before using this for the actual draw, replace that selection with the signed-in player's existing `my_flavour()` result, and retain the main app's double-blind rules. If the hunt should be the first reveal, the existing app's flavour screen must also wait until the hunt is completed. Progress currently resets on refresh.
