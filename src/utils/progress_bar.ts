
type ProgressState = { index: number, time: number };

export class ProgressBar {
	private readonly MAX_STATES = 30;
	private index = 0;
	private nextUpdateTime: number;
	private readonly total: number;
	private readonly timeStep: number;
	private readonly previousStates: ProgressState[] = [];

	constructor(total: number, timeStep = 1000) {
		this.total = total;
		this.timeStep = timeStep;
		this.nextUpdateTime = Date.now();
		this.update(0);
	}

	private log() {
		const { index, total, previousStates, MAX_STATES } = this;
		const time = Date.now();
		const progress = 100 * index / total;
		let message = `\r\x1b[K   ${index}/${total} - ${progress.toFixed(2)} %`;

		const newState: ProgressState = { index, time };
		const lastState: ProgressState = previousStates[previousStates.length - 1] || newState;
		if ((lastState.index !== index) || (lastState === newState)) {
			previousStates.unshift(newState);
			while (previousStates.length > MAX_STATES) previousStates.pop();
		}

		if (lastState.index < index) {
			const speed = 1000 * (index - lastState.index) / (time - lastState.time);
			let speedString;
			if (speed >= 1e6) {
				speedString = (speed / 1000).toFixed(0) + ' K'
			} else if (speed >= 1e5) {
				speedString = (speed / 1000).toFixed(1) + ' K'
			} else if (speed >= 1e4) {
				speedString = (speed / 1000).toFixed(2) + ' K'
			} else if (speed >= 1e3) {
				speedString = speed.toFixed(0)
			} else if (speed >= 1e2) {
				speedString = speed.toFixed(1)
			} else if (speed >= 1e1) {
				speedString = speed.toFixed(2)
			} else {
				speedString = speed.toFixed(3)
			}

			const eta = (total - index) / speed;
			const etaString = [
				Math.floor(eta / 3600).toFixed(0),
				(Math.floor(eta / 60) % 60 + 100).toFixed(0).slice(1),
				(Math.floor(eta) % 60 + 100).toFixed(0).slice(1),
			].join(':');

			message += ` - ${speedString}/s - ${etaString}`;
		}

		process.stderr.write(message);
	}

	public update(value: number) {
		this.index = value;
		if (Date.now() >= this.nextUpdateTime) {
			this.log();
			this.nextUpdateTime += this.timeStep;
		}
	}

	public increment(value = 1) {
		this.update(this.index + value);
	}

	public close() {
		this.index = this.total;
		this.log();
		process.stderr.write(`\n`);
	}
}

