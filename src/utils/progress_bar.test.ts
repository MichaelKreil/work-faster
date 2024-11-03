import type { WriteStream } from 'node:fs';
import { ProgressBar } from './progress_bar.js';
import { jest } from '@jest/globals';

describe('ProgressBar', () => {
	let progressBar: ProgressBar;
	let stderrSpy: jest.Spied<WriteStream['write']>;

	beforeEach(() => {
		jest.useFakeTimers();
		stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
		progressBar = new ProgressBar(100, 1000); // total 100, timeStep 1000 ms
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.restoreAllMocks();
	});

	it('should initialize with the correct values', () => {
		expect(progressBar['index']).toBe(0);
		expect(progressBar['total']).toBe(100);
		expect(progressBar['timeStep']).toBe(1000);
		expect(progressBar['previousStates'].length).toBe(1); // initial state should be logged
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
		jest.advanceTimersByTime(1000);
		progressBar.update(10);
		expect(stderrSpy).toHaveBeenCalled();
		expect(stderrSpy.mock.calls[stderrSpy.mock.calls.length - 1][0]).toContain('10/100 - 10.00 %');
	});

	it('should throttle updates based on timeStep', () => {
		progressBar.update(10);
		jest.advanceTimersByTime(500); // half of the time step
		progressBar.update(20);
		expect(stderrSpy).toHaveBeenCalledTimes(1); // Only one log due to throttling

		jest.advanceTimersByTime(500); // now a full timeStep has passed
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

	it('should limit previousStates array to MAX_STATES', () => {
		for (let i = 0; i < 35; i++) {
			progressBar.update(i + 1);
			jest.advanceTimersByTime(1000); // ensure logs are triggered
		}
		expect(progressBar['previousStates'].length).toBeLessThanOrEqual(30); // MAX_STATES
	});

	it('should calculate speed and ETA correctly', () => {
		progressBar.update(10);
		jest.advanceTimersByTime(1000);
		progressBar.update(20);
		jest.advanceTimersByTime(1000);

		expect(stderrSpy.mock.calls[stderrSpy.mock.calls.length - 1][0]).toMatch(/20\/100/);
		expect(stderrSpy.mock.calls[stderrSpy.mock.calls.length - 1][0]).toMatch(/\/s - \d{1,2}:\d{2}:\d{2}/); // ETA format
	});
});
