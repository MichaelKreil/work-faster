# Work Faster

## install

```bash
npm install work-faster
```

## usage

forEachAsync works in the same way as forEach, but asynchronously. Example:

```javascript
	require('work-faster');

	let list = [1,1,2,3,5];

	list.forEach(item => {
		doStuff(item)
	})

	await list.forEachAsync(async item => {
		await doStuffAsync(item)
	})
```

This will run as many callbacks in parallel as there are CPU cores. You can set a different value for maxParallel an optional second parameter:

```javascript
	await list.forEachAsync(doStuff, 4);
```
