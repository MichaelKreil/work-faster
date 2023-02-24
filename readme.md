# Async Stuff

## install

```bash
npm install async-stuff
```

## usage

forEachParallel works in the same way as forEach, but asynchronously. Example:

```javascript
	require('async-stuff');

	let list = [1,1,2,3,5];

	list.forEach(item => {
		doStuff(item)
	})

	await list.forEachParallel(async item => {
		await doStuffAsync(item)
	})
```

This will run as many callbacks in parallel as there are CPU cores. You can set a different value for maxParallel an optional second parameter:

```javascript
	await list.forEachParallel(doStuff, 4);
```
