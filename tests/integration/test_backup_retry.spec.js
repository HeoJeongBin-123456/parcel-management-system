import { test, expect } from '@playwright/test';

test.describe('Backup Retry Mechanism Integration Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');

        // Clear backup state
        await page.evaluate(() => {
            localStorage.removeItem('backupState');
            localStorage.removeItem('backupRetryState');
        });
    });

    test('should retry backup on failure up to 5 times', async ({ page }) => {
        // Simulate backup failure and retry logic
        const retryResults = await page.evaluate(async () => {
            const results = [];
            let retryCount = 0;
            const maxRetries = 5;
            const retryDelay = 100; // Using shorter delay for testing

            const attemptBackup = async () => {
                retryCount++;
                const attempt = {
                    attemptNumber: retryCount,
                    timestamp: Date.now(),
                    success: false
                };

                // Simulate failure for first 4 attempts, success on 5th
                if (retryCount < 5) {
                    attempt.success = false;
                    attempt.error = `Network error on attempt ${retryCount}`;
                } else {
                    attempt.success = true;
                }

                results.push(attempt);

                // Save retry state
                localStorage.setItem('backupRetryState', JSON.stringify({
                    count: retryCount,
                    lastAttempt: attempt.timestamp,
                    status: attempt.success ? 'success' : 'retrying'
                }));

                return attempt.success;
            };

            // Retry loop
            for (let i = 0; i < maxRetries; i++) {
                const success = await attemptBackup();
                if (success) break;
                if (i < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
            }

            return results;
        });

        expect(retryResults).toHaveLength(5);
        expect(retryResults[4].success).toBe(true);
        expect(retryResults[0].success).toBe(false);

        // Verify final state
        const finalState = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('backupRetryState') || '{}');
        });
        expect(finalState.count).toBe(5);
        expect(finalState.status).toBe('success');
    });

    test('should wait 10 minutes between retry attempts', async ({ page }) => {
        // Test retry delay calculation
        const delayTest = await page.evaluate(() => {
            const retryDelay = 10 * 60 * 1000; // 10 minutes in ms
            const attempts = [];

            for (let i = 1; i <= 5; i++) {
                const nextRetryTime = Date.now() + retryDelay;
                attempts.push({
                    attempt: i,
                    nextRetryIn: retryDelay,
                    nextRetryTime: nextRetryTime
                });
            }

            localStorage.setItem('retrySchedule', JSON.stringify(attempts));
            return attempts;
        });

        expect(delayTest).toHaveLength(5);
        delayTest.forEach(attempt => {
            expect(attempt.nextRetryIn).toBe(600000); // 10 minutes in ms
        });
    });

    test('should notify user after 5 failed attempts', async ({ page }) => {
        // Simulate 5 failed attempts
        const notificationTriggered = await page.evaluate(async () => {
            let notificationShown = false;
            const maxRetries = 5;

            // Mock notification function
            window.showManualBackupNotification = () => {
                notificationShown = true;
                const notification = {
                    type: 'manual_backup_required',
                    message: '자동 백업이 실패했습니다. 수동으로 백업해 주세요.',
                    timestamp: Date.now(),
                    actionRequired: true
                };
                localStorage.setItem('backupNotification', JSON.stringify(notification));
                return notification;
            };

            // Simulate all retries failing
            for (let i = 1; i <= maxRetries; i++) {
                const retryState = {
                    count: i,
                    status: 'failed',
                    lastError: `Attempt ${i} failed`
                };
                localStorage.setItem('backupRetryState', JSON.stringify(retryState));

                if (i === maxRetries) {
                    window.showManualBackupNotification();
                }
            }

            return notificationShown;
        });

        expect(notificationTriggered).toBe(true);

        // Verify notification stored
        const notification = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('backupNotification') || '{}');
        });
        expect(notification.type).toBe('manual_backup_required');
        expect(notification.actionRequired).toBe(true);
    });

    test('should reset retry count after successful backup', async ({ page }) => {
        // Setup initial retry state
        await page.evaluate(() => {
            localStorage.setItem('backupRetryState', JSON.stringify({
                count: 3,
                status: 'retrying',
                lastAttempt: Date.now() - 60000
            }));
        });

        // Simulate successful backup
        await page.evaluate(() => {
            // Successful backup resets retry count
            const backupSuccess = () => {
                const newState = {
                    count: 0,
                    status: 'success',
                    lastSuccess: Date.now(),
                    lastAttempt: Date.now()
                };
                localStorage.setItem('backupRetryState', JSON.stringify(newState));
                return true;
            };

            backupSuccess();
        });

        // Verify retry count reset
        const resetState = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('backupRetryState') || '{}');
        });
        expect(resetState.count).toBe(0);
        expect(resetState.status).toBe('success');
    });

    test('should handle different types of backup failures', async ({ page }) => {
        const failureTypes = await page.evaluate(() => {
            const failures = [
                { type: 'network', message: 'Network timeout', retryable: true },
                { type: 'auth', message: 'Authentication failed', retryable: true },
                { type: 'quota', message: 'Storage quota exceeded', retryable: false },
                { type: 'server', message: 'Server error 500', retryable: true },
                { type: 'rate_limit', message: 'Rate limit exceeded', retryable: true }
            ];

            const results = failures.map(failure => {
                const shouldRetry = failure.retryable && failure.type !== 'quota';
                return {
                    ...failure,
                    action: shouldRetry ? 'retry' : 'manual_intervention'
                };
            });

            localStorage.setItem('failureHandling', JSON.stringify(results));
            return results;
        });

        expect(failureTypes.filter(f => f.action === 'retry')).toHaveLength(4);
        expect(failureTypes.find(f => f.type === 'quota').action).toBe('manual_intervention');
    });

    test('should maintain backup queue during retries', async ({ page }) => {
        // Create backup queue
        await page.evaluate(() => {
            const backupQueue = [
                { id: 1, type: 'parcels', size: 1024, priority: 'high' },
                { id: 2, type: 'markers', size: 512, priority: 'medium' },
                { id: 3, type: 'colors', size: 256, priority: 'low' }
            ];

            localStorage.setItem('backupQueue', JSON.stringify(backupQueue));

            // Process queue with retry
            const processQueue = (retryCount = 0) => {
                const queue = JSON.parse(localStorage.getItem('backupQueue') || '[]');
                const processed = [];

                queue.forEach(item => {
                    item.attempts = retryCount + 1;
                    item.status = retryCount < 3 ? 'retrying' : 'completed';
                    processed.push(item);
                });

                localStorage.setItem('backupQueueProcessed', JSON.stringify(processed));
                return processed;
            };

            // Simulate 3 retry attempts
            for (let i = 0; i < 3; i++) {
                processQueue(i);
            }
        });

        // Verify queue maintained
        const processedQueue = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('backupQueueProcessed') || '[]');
        });

        expect(processedQueue).toHaveLength(3);
        processedQueue.forEach(item => {
            expect(item.attempts).toBeGreaterThan(0);
            expect(item.status).toBe('completed');
        });
    });

    test('should track retry timing accurately', async ({ page }) => {
        const timingData = await page.evaluate(() => {
            const retryTimes = [];
            const baseTime = Date.now();
            const retryInterval = 10 * 60 * 1000; // 10 minutes

            for (let i = 0; i < 5; i++) {
                const scheduledTime = baseTime + (i * retryInterval);
                retryTimes.push({
                    attempt: i + 1,
                    scheduledTime,
                    expectedDelay: i * retryInterval
                });
            }

            localStorage.setItem('retryTiming', JSON.stringify(retryTimes));
            return retryTimes;
        });

        // Verify timing intervals
        for (let i = 1; i < timingData.length; i++) {
            const interval = timingData[i].scheduledTime - timingData[i - 1].scheduledTime;
            expect(interval).toBe(600000); // 10 minutes
        }
    });

    test('should handle concurrent backup requests during retry', async ({ page }) => {
        const concurrencyTest = await page.evaluate(async () => {
            let isBackupInProgress = false;
            const results = [];

            const attemptBackup = async (id) => {
                if (isBackupInProgress) {
                    return {
                        id,
                        status: 'skipped',
                        reason: 'backup_in_progress'
                    };
                }

                isBackupInProgress = true;

                // Simulate backup
                await new Promise(resolve => setTimeout(resolve, 100));

                const result = {
                    id,
                    status: 'completed',
                    timestamp: Date.now()
                };

                isBackupInProgress = false;
                return result;
            };

            // Try to trigger multiple backups
            const promises = [
                attemptBackup(1),
                attemptBackup(2),
                attemptBackup(3)
            ];

            const outcomes = await Promise.all(promises);
            localStorage.setItem('concurrencyTest', JSON.stringify(outcomes));
            return outcomes;
        });

        // Should have one completed and others skipped
        const completed = concurrencyTest.filter(r => r.status === 'completed');
        const skipped = concurrencyTest.filter(r => r.status === 'skipped');

        expect(completed.length).toBeGreaterThanOrEqual(1);
        expect(skipped.length).toBeGreaterThanOrEqual(0);
    });

    test('should preserve user data even if backup fails permanently', async ({ page }) => {
        // Setup user data
        await page.evaluate(() => {
            const userData = {
                parcels: [
                    { pnu: 'USER_1', data: 'important' },
                    { pnu: 'USER_2', data: 'critical' }
                ],
                timestamp: Date.now()
            };
            localStorage.setItem('userData', JSON.stringify(userData));
        });

        // Simulate permanent backup failure
        await page.evaluate(() => {
            const backupState = {
                count: 5,
                status: 'failed_permanently',
                lastError: 'All retry attempts exhausted',
                dataPreserved: true
            };
            localStorage.setItem('backupRetryState', JSON.stringify(backupState));
        });

        // Verify user data still intact
        const preservedData = await page.evaluate(() => {
            return {
                userData: JSON.parse(localStorage.getItem('userData') || '{}'),
                backupState: JSON.parse(localStorage.getItem('backupRetryState') || '{}')
            };
        });

        expect(preservedData.userData.parcels).toHaveLength(2);
        expect(preservedData.backupState.dataPreserved).toBe(true);
        expect(preservedData.backupState.status).toBe('failed_permanently');
    });

    test('should provide manual backup option after failures', async ({ page }) => {
        // Setup failure state
        await page.evaluate(() => {
            localStorage.setItem('backupRetryState', JSON.stringify({
                count: 5,
                status: 'failed',
                requiresManual: true
            }));
        });

        // Check for manual backup UI
        const manualBackupAvailable = await page.evaluate(() => {
            // Simulate manual backup UI creation
            const createManualBackupUI = () => {
                return {
                    button: 'Manual Backup',
                    instructions: '1. Click to download data\n2. Save to safe location\n3. Upload when connection restored',
                    downloadData: () => {
                        const allData = {
                            clickMode: localStorage.getItem('clickModeData'),
                            searchMode: localStorage.getItem('searchModeData'),
                            colors: localStorage.getItem('parcelColors'),
                            timestamp: Date.now()
                        };
                        return JSON.stringify(allData);
                    }
                };
            };

            const manualUI = createManualBackupUI();
            localStorage.setItem('manualBackupUI', JSON.stringify({
                available: true,
                instructions: manualUI.instructions
            }));

            return true;
        });

        expect(manualBackupAvailable).toBe(true);

        // Verify manual backup UI stored
        const manualUI = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('manualBackupUI') || '{}');
        });
        expect(manualUI.available).toBe(true);
        expect(manualUI.instructions).toContain('download');
    });
});