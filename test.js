"use strict"

test()

async function test() {
	require('./index.js');

	let list = [1,1,2,3,5];

	list.forEach(item => {
		item += 2;
	})

	await list.forEachAsync(async item => {
		item += 2;
		await new Promise(res => setTimeout(res, 1));
	})

	await list.forEachAsync(async item => {
		item += 2;
		await new Promise(res => setTimeout(res, 1));
	}, 3)

}
