[![NPM Version](https://img.shields.io/npm/v/work-faster)](https://www.npmjs.com/package/work-faster)
[![NPM Downloads](https://img.shields.io/npm/d18m/work-faster)](https://www.npmjs.com/package/work-faster)
[![Code Coverage](https://codecov.io/gh/michaelkreil/work-faster/branch/main/graph/badge.svg?token=IDHAI13M0K)](https://codecov.io/gh/michaelkreil/work-faster)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/michaelkreil/work-faster/ci.yml)](https://github.com/michaelkreil/work-faster/actions/workflows/ci.yml)



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
