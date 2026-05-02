import type { WriteStream } from 'node:fs';
import type { MockInstance } from 'vitest';
import { ProgressBar } from './progress_bar.js';

describe('ProgressBar', () => {
	let progressBar: ProgressBar;
	let stderrSpy: MockInstance<WriteStream['write']>;

	beforeEach(() => {
		vi.useFakeTimers();
		stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
		progressBar = new ProgressBar(100, 1000); // total 100, timeStep 1000 ms
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.restoreAllMocks();
	});

	it('should initialize with the correct values without writing to stderr', () => {
		expect(progressBar['index']).toBe(0);
		expect(progressBar['total']).toBe(100);
		expect(progressBar['timeStep']).toBe(1000);
		expect(progressBar['previousStates'].length).toBe(0);
		expect(stderrSpy).not.toHaveBeenCalled();
	});

	it('should update progress with update method', () => {
		progressBar.update(50);
		expect(progressBar['index']).toBe(50);
	});

	it('should increment progress with increment method', () => {
		progressBar.increment(5);
		expect(progressBar['index']).toBe(5);
	});

	it('should log output to stderr when update is called at the time step', () => {
		vi.advanceTimersByTime(1000);
		progressBar.update(10);
		expect(stderrSpy).toHaveBeenCalled();
		expect(stderrSpy.mock.calls[stderrSpy.mock.calls.length - 1][0]).toContain('10/100 - 10.00 %');
	});

	it('should throttle updates based on timeStep', () => {
		vi.advanceTimersByTime(1000);
		progressBar.update(10);
		vi.advanceTimersByTime(500); // half of the time step
		progressBar.update(20);
		expect(stderrSpy).toHaveBeenCalledTimes(1); // Only one log due to throttling

		vi.advanceTimersByTime(500); // now a full timeStep has passed
		progressBar.update(30);
		expect(stderrSpy).toHaveBeenCalledTimes(2); // Second log after timeStep elapsed
	});

	it('should log final progress on close', () => {
		progressBar.close();
		expect(progressBar['index']).toBe(100);
		expect(stderrSpy).toHaveBeenCalled();
		expect(stderrSpy.mock.calls[stderrSpy.mock.calls.length - 2][0]).toContain('100/100 - 100.00 %');
		expect(stderrSpy.mock.calls[stderrSpy.mock.calls.length - 1][0]).toStrictEqual('\n');
	});

	it('should keep the actual progress value when close(false) is called', () => {
		progressBar.update(37);
		progressBar.close(false);
		expect(progressBar['index']).toBe(37);
		expect(stderrSpy.mock.calls[stderrSpy.mock.calls.length - 2][0]).toContain('37/100');
	});

	it('should limit previousStates array to MAX_STATES', () => {
		for (let i = 0; i < 35; i++) {
			progressBar.update(i + 1);
			vi.advanceTimersByTime(1000); // ensure logs are triggered
		}
		expect(progressBar['previousStates'].length).toBeLessThanOrEqual(30); // MAX_STATES
	});

	it('should not burst-log after a pause longer than timeStep', () => {
		// Initial constructor log + one log after the first timeStep.
		vi.advanceTimersByTime(1000);
		progressBar.update(10);
		const baseline = stderrSpy.mock.calls.length;

		// Simulate a long pause where update is not called.
		vi.advanceTimersByTime(10_000);

		// Five quick updates after the pause should produce one log, not five.
		progressBar.update(11);
		progressBar.update(12);
		progressBar.update(13);
		progressBar.update(14);
		progressBar.update(15);
		expect(stderrSpy.mock.calls.length).toBe(baseline + 1);
	});

	it('should not produce Infinity when two updates land in the same millisecond', () => {
		// Two qualifying updates with no time advance previously divided by zero.
		vi.advanceTimersByTime(1000);
		progressBar.update(10);
		vi.advanceTimersByTime(1000);
		progressBar.update(20);
		// Force a second log inside the same ms by reaching back into the
		// throttle to bypass the timer guard.
		progressBar['nextUpdateTime'] = Date.now();
		progressBar.update(30);
		const last = stderrSpy.mock.calls[stderrSpy.mock.calls.length - 1][0] as string;
		expect(last).not.toContain('Infinity');
	});

	it('should calculate speed and ETA correctly', () => {
		// First log establishes the baseline for the speed average.
		vi.advanceTimersByTime(1000);
		progressBar.update(10);
		vi.advanceTimersByTime(1000);
		progressBar.update(20);

		expect(stderrSpy.mock.calls[stderrSpy.mock.calls.length - 1][0]).toMatch(/20\/100/);
		expect(stderrSpy.mock.calls[stderrSpy.mock.calls.length - 1][0]).toMatch(/\/s - \d{1,2}:\d{2}:\d{2}/); // ETA format
	});
});
