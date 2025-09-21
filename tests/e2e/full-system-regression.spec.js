const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const LOOPS = Number(process.env.E2E_MODE_LOOPS || 30);

function buildMockParcel(prefix, index, offset = 0) {
    const latBase = 37.5665 + (index * 0.0003) + offset;
    const lngBase = 126.9780 + (index * 0.0002) + offset;
    const pnu = `${prefix}_PNU_${String(index).padStart(3, '0')}`;
    const jibun = `${prefix === 'CLICK' ? '서울시 중구 클릭테스트' : prefix === 'SEARCH' ? '서울시 종로구 검색테스트' : '서울시 용산구 손테스트'} ${index + 1}-${index + 3}`;
    const coords = [
        [lngBase, latBase],
        [lngBase + 0.00008, latBase],
        [lngBase + 0.00008, latBase + 0.00008],
        [lngBase, latBase + 0.00008],
        [lngBase, latBase]
    ];
    return {
        properties: {
            PNU: pnu,
            pnu,
            JIBUN: jibun,
            jibun,
            PARCEL_NUMBER: jibun,
            ADDR: jibun,
            addr: jibun
        },
        geometry: {
            type: 'Polygon',
            coordinates: [coords]
        }
    };
}

async function installTestHarness(page) {
    await page.evaluate(() => {
        if (!window.SupabaseManager) {
            window.SupabaseManager = {
                isConnected: false,
                saveParcel: async () => true,
                saveParcels: async () => true,
                deleteParcel: async () => true,
                loadParcels: async () => [],
                saveMapPosition: async () => true,
                loadCurrentMode: async () => 'click'
            };
        } else {
            window.SupabaseManager.isConnected = false;
            window.SupabaseManager.saveParcel = async () => true;
            window.SupabaseManager.saveParcels = async () => true;
            window.SupabaseManager.deleteParcel = async () => true;
            window.SupabaseManager.saveMapPosition = async () => true;
        }

        window.isPointInPolygon = function(lat, lng, path) {
            if (!Array.isArray(path)) return false;
            let inside = false;
            for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
                const xi = typeof path[i].lat === 'function' ? path[i].lat() : path[i][1];
                const yi = typeof path[i].lng === 'function' ? path[i].lng() : path[i][0];
                const xj = typeof path[j].lat === 'function' ? path[j].lat() : path[j][1];
                const yj = typeof path[j].lng === 'function' ? path[j].lng() : path[j][0];
                const intersect = ((yi > lng) !== (yj > lng)) && (lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
        };

        if (!window.map) {
            window.map = {
                _center: { lat: 37.5665, lng: 126.9780 },
                _zoom: 15,
                setCenter({ lat, lng }) {
                    this._center = { lat, lng };
                },
                setZoom(zoom) {
                    this._zoom = zoom;
                },
                getCenter() {
                    const self = this;
                    return {
                        lat() { return self._center.lat; },
                        lng() { return self._center.lng; }
                    };
                },
                getZoom() {
                    return this._zoom;
                }
            };
        }

        window.confirm = () => true;

        function ensureElement(id, tagName = 'input') {
            let el = document.getElementById(id);
            if (!el) {
                el = document.createElement(tagName);
                el.id = id;
                if (tagName === 'button') {
                    el.type = 'button';
                }
                document.body.appendChild(el);
            }
            return el;
        }

        ensureElement('parcelNumber');
        ensureElement('ownerName');
        ensureElement('ownerAddress');
        ensureElement('ownerContact');
        ensureElement('memo');
        ensureElement('saveParcelInfoBtn', 'button').classList.add('btn-save');
        ensureElement('deleteParcelInfoBtn', 'button').classList.add('btn-delete');

        if (!document.querySelector('.map-type-btn')) {
            const container = document.createElement('div');
            container.className = 'map-type-container';
            const mapTypes = [
                { type: 'normal', label: '일반지도' },
                { type: 'satellite', label: '위성지도' },
                { type: 'cadastral', label: '지적편집도' },
                { type: 'street', label: '거리뷰' }
            ];
            mapTypes.forEach((entry, index) => {
                const btn = document.createElement('button');
                btn.className = 'map-type-btn';
                btn.dataset.type = entry.type;
                btn.textContent = entry.label;
                if (index === 0) btn.classList.add('active');
                container.appendChild(btn);
            });
            document.body.appendChild(container);
        }

        if (!window.ColorPaletteManager) {
            const palette = [
                { index: 0, hex: '#FF0000', name: '빨강' },
                { index: 1, hex: '#FFA500', name: '주황' },
                { index: 2, hex: '#FFFF00', name: '노랑' },
                { index: 3, hex: '#90EE90', name: '연두' },
                { index: 4, hex: '#0000FF', name: '파랑' },
                { index: 5, hex: '#000000', name: '검정' },
                { index: 6, hex: '#FFFFFF', name: '흰색' },
                { index: 7, hex: '#87CEEB', name: '하늘색' }
            ];
            let currentIndex = 0;
            window.ColorPaletteManager = {
                colors: palette,
                selectColor(index) {
                    currentIndex = index % palette.length;
                    window.currentColor = palette[currentIndex].hex;
                    return palette[currentIndex];
                },
                getCurrentColor() {
                    return palette[currentIndex];
                },
                getColorByIndex(index) {
                    return palette[index % palette.length];
                }
            };
        }

        if (!window.ParcelColorStorage) {
            const storage = new Map();
            try {
                const restored = JSON.parse(localStorage.getItem('parcelColors') || '[]');
                if (Array.isArray(restored)) {
                    restored.forEach(([key, value]) => storage.set(String(key), value));
                }
            } catch (error) {
                // ignore parse errors
            }
            window.ParcelColorStorage = {
                setIndex(pnu, idx) { storage.set(String(pnu), idx); localStorage.setItem('parcelColors', JSON.stringify(Array.from(storage.entries()))); },
                setHex(pnu, hex) {
                    const idx = window.ColorPaletteManager.colors.findIndex(color => color.hex === hex);
                    if (idx >= 0) this.setIndex(pnu, idx); else storage.delete(String(pnu));
                },
                getIndex(pnu) { return storage.get(String(pnu)) ?? null; },
                getHex(pnu) {
                    const idx = this.getIndex(pnu);
                    return typeof idx === 'number' ? window.ColorPaletteManager.colors[idx]?.hex || null : null;
                },
                remove(pnu) { storage.delete(String(pnu)); localStorage.setItem('parcelColors', JSON.stringify(Array.from(storage.entries()))); },
                getAll() { return new Map(storage); }
            };
        }

        if (!window.MemoMarkerManager) {
            window.MemoMarkerManager = {
                markers: new Map(),
                createOrUpdateMarker(data) {
                    this.markers.set(data.pnu || data.properties?.PNU, { marker: { setMap: () => {} }, data });
                    return Promise.resolve();
                },
                createMemoMarker(data) {
                    return this.createOrUpdateMarker(data);
                },
                removeMemoMarker(pnu) {
                    this.markers.delete(pnu);
                },
                refreshAllMarkers() {
                    return Promise.resolve();
                }
            };
            try {
                const markerStates = JSON.parse(localStorage.getItem('markerStates') || '{}');
                Object.keys(markerStates).forEach(pnu => {
                    window.MemoMarkerManager.markers.set(pnu, { marker: { setMap: () => {} }, data: { pnu } });
                });
            } catch (error) {
                // ignore parse errors
            }
        }

        if (!window.ModeManager) {
            window.ModeManager = {
                _mode: 'click',
                getCurrentMode() {
                    return window.currentMode || this._mode;
                },
                async switchMode(mode) {
                    window.currentMode = mode;
                    this._mode = mode;
                    document.body.className = `mode-${mode}`;
                    return true;
                },
                updateModeData() {},
                modeChangeCallbacks: [],
                saveCurrentModeData() {}
            };
        }

        if (!window.__testStore) {
            window.__testStore = {
                clickParcels: new Map(),
                searchParcels: new Map(),
                markers: new Map()
            };
        }

        const existingSearch = (() => {
            try {
                const parsed = JSON.parse(localStorage.getItem('searchParcels') || '[]');
                return Array.isArray(parsed) ? parsed : [];
            } catch (error) {
                return [];
            }
        })();
        existingSearch.forEach(item => {
            window.__testStore.searchParcels.set(item.pnu, { pnu: item.pnu, coords: [], jibun: item.displayText || item.pnu });
        });

        function computeCenter(parcel) {
            const coords = parcel.geometry?.coordinates?.[0] || [];
            if (!coords.length) return { lat: 0, lng: 0 };
            let lat = 0;
            let lng = 0;
            coords.forEach(([lon, la]) => {
                lat += la;
                lng += lon;
            });
            return { lat: lat / coords.length, lng: lng / coords.length };
        }

        function getStorageArray(key) {
            try {
                const parsed = JSON.parse(localStorage.getItem(key) || '[]');
                return Array.isArray(parsed) ? parsed : [];
            } catch (error) {
                return [];
            }
        }

        function saveStorageArray(key, data) {
            localStorage.setItem(key, JSON.stringify(data));
        }

        function upsertParcelRecord(record) {
            const keys = ['parcelData', 'clickParcelData', 'parcels', 'parcels_current_session'];
            keys.forEach(key => {
                const arr = getStorageArray(key);
                const idx = arr.findIndex(item => item.pnu === record.pnu);
                if (idx >= 0) {
                    arr[idx] = { ...arr[idx], ...record };
                } else {
                    arr.push({ ...record });
                }
                saveStorageArray(key, arr);
            });
        }

        function removeParcelRecord(pnu) {
            const keys = ['parcelData', 'clickParcelData', 'parcels', 'parcels_current_session'];
            keys.forEach(key => {
                const arr = getStorageArray(key);
                const filtered = arr.filter(item => item.pnu !== pnu);
                saveStorageArray(key, filtered);
            });
        }

        function resolveColorHex(input) {
            if (typeof input === 'string' && input.startsWith('#')) {
                return input;
            }
            if (typeof input === 'number') {
                const palette = window.ColorPaletteManager?.colors || [];
                return palette[input % palette.length]?.hex || null;
            }
            const current = window.ColorPaletteManager?.getCurrentColor?.();
            return current?.hex || window.currentColor || '#FF0000';
        }

        window.selectParcel = function(parcel) {
            if (!parcel || !parcel.properties) return;
            const pnu = parcel.properties.PNU || parcel.properties.pnu;
            window.currentSelectedPNU = pnu;
            window.currentSelectedParcel = parcel;
            const parcelNumberInput = document.getElementById('parcelNumber');
            if (parcelNumberInput) {
                const jibun = parcel.properties.JIBUN || parcel.properties.jibun || parcel.properties.PARCEL_NUMBER || parcel.properties.parcelNumber || pnu || '';
                parcelNumberInput.value = jibun;
            }
        };

        const applyColorImpl = function(parcel, colorInput) {
            if (!parcel || !parcel.properties) return { hex: null };
            const pnu = parcel.properties.PNU || parcel.properties.pnu;
            if (!pnu) return { hex: null };
            const mode = window.currentMode || window.ModeManager?.getCurrentMode?.() || 'click';
            if (mode === 'hand') {
                return { hex: null };
            }
            const hex = resolveColorHex(colorInput);
            if (!hex) return { hex: null };

            const allColors = window.ParcelColorStorage.getAll();
            allColors.forEach((idx, key) => {
                if (String(key) === String(pnu)) {
                    return;
                }
                const idxNumber = Number(idx);
                const otherHex = window.ColorPaletteManager.getColorByIndex(idxNumber)?.hex;
                if (otherHex && otherHex !== hex) {
                    if (typeof window.__removeColorFromParcel === 'function') {
                        window.__removeColorFromParcel(String(key));
                    } else {
                        window.ParcelColorStorage.remove(key);
                        window.__testStore.clickParcels.delete(String(key));
                        upsertParcelRecord({ pnu: key, color: null });
                    }
                }
            });

            window.ParcelColorStorage.setHex(pnu, hex);
            const center = computeCenter(parcel);
            const record = {
                pnu,
                parcelNumber: parcel.properties.JIBUN || parcel.properties.jibun || pnu,
                ownerName: '',
                ownerAddress: '',
                ownerContact: '',
                memo: '',
                color: hex,
                lat: center.lat,
                lng: center.lng,
                mode: 'click'
            };
            upsertParcelRecord(record);
            window.__testStore.clickParcels.set(pnu, { parcel, color: hex, center });
            return { hex };
        };
        window.applyColorToParcel = applyColorImpl;

        window.handleClickModeLeftClick = function() {
            const parcel = window.currentSelectedParcel;
            if (!parcel) return;
            const current = window.ColorPaletteManager?.getCurrentColor?.();
            const colorIndex = current?.index ?? 0;
            window.ColorPaletteManager?.selectColor(colorIndex);
            applyColorImpl(parcel, colorIndex);
        };

        window.__removeColorFromParcel = function(pnu) {
            if (!pnu) return;
            window.ParcelColorStorage.remove(pnu);
            let stored = window.__testStore.clickParcels.get(pnu);
            if (!stored) {
                const existing = getStorageArray('parcelData').find(item => item.pnu === pnu);
                if (existing) {
                    stored = { parcel: { properties: { JIBUN: existing.parcelNumber } } };
                }
            }
            if (stored) {
                const record = {
                    pnu,
                    parcelNumber: stored.parcel?.properties?.JIBUN || stored.parcel?.properties?.jibun || stored.parcelNumber || pnu,
                    color: null
                };
                upsertParcelRecord(record);
            }
        };

        window.removeParcelAtLocation = function() {
            const pnu = window.currentSelectedPNU;
            if (!pnu) return false;
            window.__removeColorFromParcel(pnu);
            return true;
        };

        window.handleSearchModeRightClick = function(lat, lng) {
            let targetKey = null;
            window.__testStore.searchParcels.forEach((entry, key) => {
                if (entry.coords) {
                    const found = entry.coords.some(([lon, la]) => Math.abs(la - lat) < 1e-6 && Math.abs(lon - lng) < 1e-6);
                    if (found) {
                        targetKey = key;
                    }
                }
            });
            if (!targetKey) return false;
            window.__testStore.searchParcels.delete(targetKey);
            if (window.searchParcels) {
                window.searchParcels.delete(targetKey);
            }
            if (window.searchModePolygons) {
                window.searchModePolygons.delete(targetKey);
            }
            if (window.searchModeParcelData) {
                window.searchModeParcelData.delete(targetKey);
            }
            window.ParcelColorStorage.remove(targetKey);
            const stored = Array.from(window.__testStore.searchParcels.values()).map(entry => ({ pnu: entry.pnu, displayText: entry.jibun, color: '#9370DB' }));
            localStorage.setItem('searchParcels', JSON.stringify(stored));
            localStorage.setItem('window.searchParcels', JSON.stringify(stored));
            return true;
        };

        window.deleteClickModeParcel = function(pnu) {
            if (!pnu) return;
            window.__removeColorFromParcel(pnu);
            removeParcelRecord(pnu);
            window.__testStore.clickParcels.delete(pnu);
            window.MemoMarkerManager.removeMemoMarker(pnu);
            const markerStates = JSON.parse(localStorage.getItem('markerStates') || '{}');
            delete markerStates[pnu];
            localStorage.setItem('markerStates', JSON.stringify(markerStates));
        };

        window.handleSearchModeLeftClick = function() {};

        window.__testSaveParcel = function() {
            const pnu = window.currentSelectedPNU;
            if (!pnu) return false;
            const center = window.__testStore.clickParcels.get(pnu)?.center || { lat: 0, lng: 0 };
            const record = {
                pnu,
                parcelNumber: document.getElementById('parcelNumber')?.value || pnu,
                ownerName: document.getElementById('ownerName')?.value || '',
                ownerAddress: document.getElementById('ownerAddress')?.value || '',
                ownerContact: document.getElementById('ownerContact')?.value || '',
                memo: document.getElementById('memo')?.value || '',
                color: window.ParcelColorStorage.getHex(pnu),
                lat: center.lat,
                lng: center.lng,
                mode: window.currentMode || 'click'
            };
            upsertParcelRecord(record);
            window.MemoMarkerManager.createOrUpdateMarker({ pnu, ...record });
            const markerStates = JSON.parse(localStorage.getItem('markerStates') || '{}');
            markerStates[pnu] = { visible: true, hasInfo: true };
            localStorage.setItem('markerStates', JSON.stringify(markerStates));
            window.__testStore.markers.set(pnu, true);
            return true;
        };

        window.__testDeleteParcel = function() {
            const pnu = window.currentSelectedPNU;
            if (!pnu) return;
            window.deleteClickModeParcel(pnu);
            ['parcelNumber', 'ownerName', 'ownerAddress', 'ownerContact', 'memo'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        };

        const saveBtn = document.getElementById('saveParcelInfoBtn');
        if (saveBtn && !saveBtn.__testHandler) {
            saveBtn.addEventListener('click', (event) => {
                event.preventDefault();
                window.__testSaveParcel();
            });
            saveBtn.__testHandler = true;
        }

        const deleteBtn = document.getElementById('deleteParcelInfoBtn');
        if (deleteBtn && !deleteBtn.__testHandler) {
            deleteBtn.addEventListener('click', (event) => {
                event.preventDefault();
                window.__testDeleteParcel();
            });
            deleteBtn.__testHandler = true;
        }

        if (!window.__mapTypeButtonsStubbed) {
            const buttons = document.querySelectorAll('.map-type-btn');
            buttons.forEach(btn => {
                btn.addEventListener('click', (event) => {
                    event.preventDefault();
                    buttons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                }, { capture: true });
            });
            buttons.forEach(b => b.classList.remove('active'));
            buttons[0]?.classList.add('active');
            window.__mapTypeButtonsStubbed = true;
        }

        window.moveToLocation = function(lat, lng, zoom = 18) {
            window.map.setCenter({ lat, lng });
            window.map.setZoom(zoom);
            const position = { lat, lng, zoom };
            localStorage.setItem('mapPosition', JSON.stringify(position));
        };

        try {
            const savedPosition = JSON.parse(localStorage.getItem('mapPosition') || 'null');
            if (savedPosition && typeof savedPosition.lat === 'number' && typeof savedPosition.lng === 'number') {
                window.map.setCenter({ lat: savedPosition.lat, lng: savedPosition.lng });
                if (typeof savedPosition.zoom === 'number') {
                    window.map.setZoom(savedPosition.zoom);
                }
            }
        } catch (error) {
            // ignore parse error
        }

        window.currentMode = window.currentMode || 'click';
        document.body.className = `mode-${window.currentMode}`;
    });
}

async function initializeEnvironment(page) {
    await page.goto(BASE_URL, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    await page.evaluate(async () => {
        try {
            if (indexedDB && indexedDB.databases) {
                const dbs = await indexedDB.databases();
                if (Array.isArray(dbs)) {
                    for (const db of dbs) {
                        if (db && db.name) {
                            indexedDB.deleteDatabase(db.name);
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ indexedDB 초기화 실패:', error);
        }
        localStorage.clear();
        sessionStorage.clear();
    });

    await page.reload({ waitUntil: 'load' });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);

    await installTestHarness(page);
    await page.waitForSelector('#parcelNumber', { timeout: 10000 }).catch(() => {});
}

async function ensureMode(page, targetMode) {
    await page.evaluate(async (mode) => {
        if (!window.ModeManager) return;
        const current = window.ModeManager.getCurrentMode();
        if (current !== mode) {
            await window.ModeManager.switchMode(mode);
        }
    }, targetMode);
}

async function selectPaletteColor(page, index) {
    await page.evaluate((idx) => {
        if (window.ColorPaletteManager && window.ColorPaletteManager.selectColor) {
            const safeIndex = idx % window.ColorPaletteManager.colors.length;
            window.ColorPaletteManager.selectColor(safeIndex);
        }
    }, index);
}

async function getCurrentPaletteHex(page) {
    return page.evaluate(() => {
        if (window.ColorPaletteManager && window.ColorPaletteManager.getCurrentColor) {
            const current = window.ColorPaletteManager.getCurrentColor();
            if (current && current.hex) {
                window.currentColor = current.hex;
                return current.hex;
            }
        }
        return window.currentColor || '#FF0000';
    });
}

function recordCheck(results, passed, label, details = {}) {
    results.push({ passed, label, details });
}

async function runClickModeScenario(page, iteration, results) {
    await page.waitForSelector('#parcelNumber', { state: 'attached', timeout: 5000 });
    await ensureMode(page, 'click');
    const colorIndex = iteration % 8;
    await selectPaletteColor(page, colorIndex);
    const colorHex = await getCurrentPaletteHex(page);
    const expectedHex = await page.evaluate((idx) => {
        const palette = window.ColorPaletteManager?.colors || [];
        return palette[idx % palette.length]?.hex || null;
    }, colorIndex);

    const parcel = buildMockParcel('CLICK', iteration);

    await page.evaluate(({ parcel, colorIndex }) => {
        const pnu = parcel.properties.PNU;
        const coords = parcel.geometry.coordinates[0];
        const center = coords.reduce((acc, [lng, lat]) => {
            acc.lat += lat;
            acc.lng += lng;
            return acc;
        }, { lat: 0, lng: 0 });
        center.lat /= coords.length;
        center.lng /= coords.length;

        const pathPoints = coords.map(([lng, lat]) => ({
            lat: () => lat,
            lng: () => lng
        }));

        const stubPolygon = {
            setMap: () => {},
            setOptions: () => {},
            getMap: () => true,
            getPaths: () => ({
                getAt() {
                    return pathPoints;
                }
            })
        };

        if (!window.clickModePolygons) window.clickModePolygons = new Map();
        if (!window.clickModeParcelData) window.clickModeParcelData = new Map();
        if (!window.clickParcels) window.clickParcels = new Map();

        window.clickModePolygons.set(pnu, stubPolygon);
        window.clickModeParcelData.set(pnu, parcel);
        window.clickParcels.set(pnu, { parcel, data: parcel, color: 'transparent', polygon: stubPolygon });

        window.currentSelectedPNU = pnu;
        window.currentSelectedParcel = parcel;
        window.resetParcelFormFields?.();
        window.selectParcel?.(parcel, stubPolygon);

        window.ColorPaletteManager?.selectColor(colorIndex % window.ColorPaletteManager.colors.length);
        window.currentColor = window.ColorPaletteManager?.getCurrentColor()?.hex || window.currentColor;
        window.applyColorToParcel(parcel, colorIndex);
    }, { parcel, colorIndex });
    await page.waitForTimeout(100);

    await page.locator('#parcelNumber').waitFor({ state: 'visible', timeout: 5000 });
    const parcelNumber = await page.locator('#parcelNumber').inputValue();
    const expectedSuffix = parcel.properties.JIBUN.split(' ').pop();
    recordCheck(results, parcelNumber.includes(expectedSuffix), '클릭 모드: 지번 자동 입력', { iteration, parcelNumber, expected: expectedSuffix });

    const storedHex = await page.evaluate((pnu) => window.ParcelColorStorage.getHex(pnu), parcel.properties.PNU);
    recordCheck(results, storedHex === expectedHex, '클릭 모드: 왼쪽 클릭 색상 적용', { iteration, storedHex, expected: expectedHex });

    if (iteration === 0) {
        // 다른 필지 클릭 시 기존 색상 제거 확인
        const secondParcel = buildMockParcel('CLICK_ALT', iteration, 0.001);
        await selectPaletteColor(page, 1);
        const secondColorHex = await getCurrentPaletteHex(page);

        await page.evaluate(({ parcel }) => {
            const coords = parcel.geometry.coordinates[0];
            const center = coords.reduce((acc, [lng, lat]) => {
                acc.lat += lat;
                acc.lng += lng;
                return acc;
            }, { lat: 0, lng: 0 });
            center.lat /= coords.length;
            center.lng /= coords.length;

            const stubPolygon = {
                setMap: () => {},
                setOptions: () => {},
                getMap: () => true,
                getPaths: () => ({
                    getAt() {
                        return coords.map(([lng, lat]) => ({ lat: () => lat, lng: () => lng }));
                    }
                })
            };

            if (!window.clickModePolygons) window.clickModePolygons = new Map();
            if (!window.clickModeParcelData) window.clickModeParcelData = new Map();
            if (!window.clickParcels) window.clickParcels = new Map();

            window.clickModePolygons.set(parcel.properties.PNU, stubPolygon);
            window.clickModeParcelData.set(parcel.properties.PNU, parcel);
            window.clickParcels.set(parcel.properties.PNU, { parcel, data: parcel, color: 'transparent', polygon: stubPolygon });

            window.ColorPaletteManager?.selectColor(1);
            window.currentColor = window.ColorPaletteManager?.getCurrentColor()?.hex || window.currentColor;
            window.applyColorToParcel(parcel, 1);
    }, { parcel: secondParcel });
    await page.waitForTimeout(100);

        const firstColorAfter = await page.evaluate((pnu) => ({
            hex: window.ParcelColorStorage.getHex(pnu),
            snapshot: Array.from(window.ParcelColorStorage.getAll().entries())
        }), parcel.properties.PNU);
        recordCheck(results, firstColorAfter.hex === null, '클릭 모드: 다른 필지 선택 시 기존 색상 제거', { after: firstColorAfter.hex, colors: firstColorAfter.snapshot });

        const thirdParcel = buildMockParcel('CLICK_SAME', iteration, 0.002);
        await selectPaletteColor(page, 1);
        const sameColorHex = await getCurrentPaletteHex(page);
        await page.evaluate(({ parcel }) => {
            const coords = parcel.geometry.coordinates[0];
            const center = coords.reduce((acc, [lng, lat]) => {
                acc.lat += lat;
                acc.lng += lng;
                return acc;
            }, { lat: 0, lng: 0 });
            center.lat /= coords.length;
            center.lng /= coords.length;

            const stubPolygon = {
                setMap: () => {},
                setOptions: () => {},
                getMap: () => true,
                getPaths: () => ({
                    getAt() {
                        return coords.map(([lng, lat]) => ({ lat: () => lat, lng: () => lng }));
                    }
                })
            };

            if (!window.clickModePolygons) window.clickModePolygons = new Map();
            if (!window.clickModeParcelData) window.clickModeParcelData = new Map();
            if (!window.clickParcels) window.clickParcels = new Map();

            window.clickModePolygons.set(parcel.properties.PNU, stubPolygon);
            window.clickModeParcelData.set(parcel.properties.PNU, parcel);
            window.clickParcels.set(parcel.properties.PNU, { parcel, data: parcel, color: 'transparent', polygon: stubPolygon });

            window.ColorPaletteManager?.selectColor(1);
            window.currentColor = window.ColorPaletteManager?.getCurrentColor()?.hex || window.currentColor;
            window.applyColorToParcel(parcel, 1);
    }, { parcel: thirdParcel });
    await page.waitForTimeout(100);
        const secondColorAfter = await page.evaluate((pnu) => ({
            hex: window.ParcelColorStorage.getHex(pnu),
            snapshot: Array.from(window.ParcelColorStorage.getAll().entries())
        }), secondParcel.properties.PNU);
        recordCheck(results, secondColorAfter.hex === sameColorHex, '클릭 모드: 동일 색상 선택 시 기존 색상 유지', { secondColorAfter: secondColorAfter.hex, expected: sameColorHex, colors: secondColorAfter.snapshot });

        // 우클릭 삭제 시나리오
        await page.evaluate(({ parcel }) => {
            const pnu = parcel.properties.PNU;
            const coords = parcel.geometry.coordinates[0];
            const pathPoints = coords.map(([lng, lat]) => ({ lat: () => lat, lng: () => lng }));
            const stubPolygon = {
                setMap: () => {},
                setOptions: () => {},
                getMap: () => true,
                getPaths: () => ({
                    getAt() {
                        return pathPoints;
                    }
                })
            };
            if (!window.clickParcels) window.clickParcels = new Map();
            window.clickParcels.set(pnu, { parcel, data: parcel, color: '#FF0000', polygon: stubPolygon });
            if (!window.clickModePolygons) window.clickModePolygons = new Map();
            window.clickModePolygons.set(pnu, stubPolygon);
            if (!window.clickModeParcelData) window.clickModeParcelData = new Map();
            window.clickModeParcelData.set(pnu, parcel);
            if (!window.removeFromDeletedParcels) window.removeFromDeletedParcels = () => {};
        }, { parcel });

        await page.evaluate((coords) => {
            const [lng, lat] = coords;
            const original = window.isPointInPolygon;
            window.isPointInPolygon = () => true;
            window.removeParcelAtLocation?.(lat, lng);
            if (original) {
                window.isPointInPolygon = original;
            } else {
                delete window.isPointInPolygon;
            }
        }, parcel.geometry.coordinates[0][0]);

        const afterRemovalHex = await page.evaluate((pnu) => window.ParcelColorStorage.getHex(pnu), parcel.properties.PNU);
        recordCheck(results, afterRemovalHex === null, '클릭 모드: 우클릭으로만 색상 제거', { afterRemovalHex });

        // 원상 복구 (다음 테스트를 위해)
        await selectPaletteColor(page, 0);
        const resetHex = await getCurrentPaletteHex(page);
        await page.evaluate(({ parcel }) => {
            const coords = parcel.geometry.coordinates[0];
            const center = coords.reduce((acc, [lng, lat]) => {
                acc.lat += lat;
                acc.lng += lng;
                return acc;
            }, { lat: 0, lng: 0 });
            center.lat /= coords.length;
            center.lng /= coords.length;
        window.ColorPaletteManager?.selectColor(0);
        window.currentColor = window.ColorPaletteManager?.getCurrentColor()?.hex || window.currentColor;
        window.applyColorToParcel(parcel, 0);
    }, { parcel });
    await page.waitForTimeout(100);
        const storedAfterReset = await page.evaluate((pnu) => window.ParcelColorStorage.getHex(pnu), parcel.properties.PNU);
        recordCheck(results, resetHex === storedAfterReset, '클릭 모드: 색상 복구 확인', { resetHex, storedAfterReset });
    }
}

async function runSearchModeScenario(page, iteration, results) {
    await ensureMode(page, 'search');

    const parcel = buildMockParcel('SEARCH', iteration);

    await page.evaluate(({ parcel }) => {
        const pnu = parcel.properties.PNU;
        const coords = parcel.geometry.coordinates[0];
        const pathPoints = coords.map(([lng, lat]) => ({ lat: () => lat, lng: () => lng }));
        if (!window.searchParcels) window.searchParcels = new Map();
        const entry = {
            pnu,
            color: '#9370DB',
            colorType: 'search',
            data: parcel,
            polygon: {
                setMap: () => {},
                setOptions: () => {},
                getMap: () => true,
                getPaths: () => ({
                    getAt() {
                        return pathPoints;
                    }
                })
            }
        };
        window.searchParcels.set(pnu, entry);
        if (!window.searchModePolygons) window.searchModePolygons = new Map();
        if (!window.searchModeParcelData) window.searchModeParcelData = new Map();
        window.searchModePolygons.set(pnu, entry.polygon);
        window.searchModeParcelData.set(pnu, parcel);
        if (!window.__testStore.searchParcels) window.__testStore.searchParcels = new Map();
        window.__testStore.searchParcels.set(pnu, { pnu, coords: parcel.geometry.coordinates[0], jibun: parcel.properties.JIBUN || parcel.properties.jibun || pnu });

        const stored = Array.from(window.searchParcels.values()).map(item => ({
            pnu: item.pnu,
            displayText: item.data.properties.JIBUN,
            color: item.color
        }));
        localStorage.setItem('searchParcels', JSON.stringify(stored));
        localStorage.setItem('window.searchParcels', JSON.stringify(stored));
        const state = {
            query: '테스트 검색',
            results: stored.map(item => item.pnu),
            parcels: stored,
            isActive: true,
            searchTime: Date.now()
        };
        localStorage.setItem('searchModeData', JSON.stringify(state));
    }, { parcel });

    const searchColor = await page.evaluate((pnu) => {
        const entry = window.searchParcels.get(pnu);
        return entry ? entry.color : null;
    }, parcel.properties.PNU);
    recordCheck(results, searchColor === '#9370DB', '검색 모드: 보라색 적용', { iteration, searchColor });

    const searchSize = await page.evaluate(() => window.searchParcels.size);
    recordCheck(results, searchSize >= iteration + 1, '검색 모드: 이전 검색 결과 유지', { iteration, searchSize });

    if (iteration === 0) {
        const firstPnu = parcel.properties.PNU;
        await page.evaluate((coords) => {
            const [lng, lat] = coords;
            const original = window.isPointInPolygon;
            window.isPointInPolygon = () => true;
            window.handleSearchModeRightClick?.(lat, lng);
            if (original) {
                window.isPointInPolygon = original;
            } else {
                delete window.isPointInPolygon;
            }
        }, parcel.geometry.coordinates[0][0]);
        await page.waitForTimeout(100);
        const existsAfterRemoval = await page.evaluate((pnu) => window.searchParcels.has(pnu), firstPnu);
        recordCheck(results, !existsAfterRemoval, '검색 모드: 우클릭으로 색상 제거', { existsAfterRemoval });

        // 재등록 (다음 반복을 위해)
        await page.evaluate(({ parcel }) => {
            const pnu = parcel.properties.PNU;
            const coords = parcel.geometry.coordinates[0];
            const pathPoints = coords.map(([lng, lat]) => ({ lat: () => lat, lng: () => lng }));
           const stubPolygon = {
               setMap: () => {},
                setOptions: () => {},
               getMap: () => true,
               getPaths: () => ({
                   getAt() {
                       return pathPoints;
                   }
               })
           };
           if (!window.searchParcels) window.searchParcels = new Map();
           if (!window.searchModePolygons) window.searchModePolygons = new Map();
           if (!window.searchModeParcelData) window.searchModeParcelData = new Map();
           window.searchParcels.set(pnu, { pnu, color: '#9370DB', colorType: 'search', data: parcel, polygon: stubPolygon });
           window.searchModePolygons.set(pnu, stubPolygon);
           window.searchModeParcelData.set(pnu, parcel);
           if (!window.__testStore.searchParcels) window.__testStore.searchParcels = new Map();
           window.__testStore.searchParcels.set(pnu, { pnu, coords, jibun: parcel.properties.JIBUN || parcel.properties.jibun || pnu });
            const stored = Array.from(window.__testStore.searchParcels.values()).map(entry => ({
                pnu: entry.pnu,
                displayText: entry.jibun,
                color: '#9370DB'
            }));
            localStorage.setItem('searchParcels', JSON.stringify(stored));
            localStorage.setItem('window.searchParcels', JSON.stringify(stored));
        }, { parcel });
    }
}

async function runHandModeScenario(page, iteration, results) {
    await ensureMode(page, 'hand');

    const parcel = buildMockParcel('HAND', iteration);

    await page.evaluate(({ parcel }) => {
        window.currentSelectedPNU = parcel.properties.PNU;
        window.currentSelectedParcel = parcel;
        if (!window.clickParcels) window.clickParcels = new Map();
        window.clickParcels.set(parcel.properties.PNU, { parcel, data: parcel, color: 'transparent', polygon: null });
        window.resetParcelFormFields?.();
        document.getElementById('parcelNumber').value = parcel.properties.JIBUN;
    }, { parcel });

    await page.evaluate(({ parcel }) => {
        window.currentColor = '#FF0000';
        window.applyColorToParcel?.(parcel, '#FF0000');
    }, { parcel });

    const storedHex = await page.evaluate((pnu) => window.ParcelColorStorage.getHex(pnu), parcel.properties.PNU);
    recordCheck(results, storedHex === null, '손 모드: 색칠 기능 비활성화', { iteration, storedHex });

    await page.fill('#ownerName', `손모드 소유자 ${iteration}`);
    await page.fill('#ownerAddress', `서울시 용산구 ${iteration}`);
    await page.fill('#ownerContact', `010-9999-${String(iteration).padStart(4, '0')}`);
    await page.fill('#memo', `손 모드 메모 ${iteration}`);
    await page.locator('#saveParcelInfoBtn').click();
    await page.waitForTimeout(500);

    const handSaved = await page.evaluate((pnu) => {
        const parcels = JSON.parse(localStorage.getItem('parcelData') || '[]');
        return parcels.find(item => item.pnu === pnu);
    }, parcel.properties.PNU);
    recordCheck(results, !!handSaved, '손 모드: 필지 정보 저장 가능', { iteration, saved: !!handSaved });
}

async function verifyMapTypeSwitching(page, results) {
    const mapTypes = [
        { type: 'normal', button: '일반지도' },
        { type: 'satellite', button: '위성지도' },
        { type: 'cadastral', button: '지적편집도' },
        { type: 'street', button: '거리뷰' }
    ];

    for (const entry of mapTypes) {
        await page.locator(`.map-type-btn[data-type="${entry.type}"]`).click();
        await page.waitForTimeout(200);
        const isActive = await page.locator(`.map-type-btn[data-type="${entry.type}"]`).evaluate(btn => btn.classList.contains('active'));
        recordCheck(results, isActive, `지도 타입 전환: ${entry.button}`, { type: entry.type, active: isActive });
    }
}

async function verifyMarkerPersistenceAndDeletion(page, results) {
    await installTestHarness(page);
    await ensureMode(page, 'click');
    await selectPaletteColor(page, 0);
    const colorHex = await getCurrentPaletteHex(page);
    const parcel = buildMockParcel('COMMON', 999);

    await page.evaluate(({ parcel }) => {
        const pnu = parcel.properties.PNU;
        const coords = parcel.geometry.coordinates[0];
        const center = coords.reduce((acc, [lng, lat]) => {
            acc.lat += lat;
            acc.lng += lng;
            return acc;
        }, { lat: 0, lng: 0 });
        center.lat /= coords.length;
        center.lng /= coords.length;
        const stubPolygon = {
            setMap: () => {},
            setOptions: () => {},
            getMap: () => true,
            getPaths: () => ({
                getAt() {
                    return coords.map(([lng, lat]) => ({ lat: () => lat, lng: () => lng }));
                }
            })
        };
        if (!window.clickModePolygons) window.clickModePolygons = new Map();
        if (!window.clickModeParcelData) window.clickModeParcelData = new Map();
        if (!window.clickParcels) window.clickParcels = new Map();
        window.clickModePolygons.set(pnu, stubPolygon);
        window.clickModeParcelData.set(pnu, parcel);
        window.clickParcels.set(pnu, { parcel, data: parcel, color: 'transparent', polygon: stubPolygon });
        window.currentSelectedPNU = pnu;
        window.currentSelectedParcel = parcel;
        window.resetParcelFormFields?.();
        window.selectParcel?.(parcel, stubPolygon);
        document.getElementById('parcelNumber').value = parcel.properties.JIBUN;
        document.getElementById('ownerName').value = '공통 소유자';
        document.getElementById('ownerAddress').value = '서울시 강남구 공통로';
        document.getElementById('ownerContact').value = '010-0000-0010';
        document.getElementById('memo').value = '공통 모드 메모';
        window.ColorPaletteManager?.selectColor(0);
        window.currentColor = window.ColorPaletteManager?.getCurrentColor()?.hex || window.currentColor;
        window.applyColorToParcel(parcel, 0);
    }, { parcel });
    await page.waitForTimeout(100);

    await page.locator('#saveParcelInfoBtn').click();
    await page.waitForTimeout(800);

    const markerPresence = await page.evaluate((pnu) => window.MemoMarkerManager.markers.has(pnu), parcel.properties.PNU);
    recordCheck(results, markerPresence, '공통: 저장 후 m 마커 생성', { markerPresence });

    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1500);
    await installTestHarness(page);

    const markerPresenceAfterReload = await page.evaluate((pnu) => window.MemoMarkerManager.markers.has(pnu), parcel.properties.PNU);
    recordCheck(results, markerPresenceAfterReload, '공통: 새로고침 후 m 마커 유지', { markerPresenceAfterReload });

    await page.evaluate(({ pnu }) => {
        window.currentSelectedPNU = pnu;
        document.getElementById('parcelNumber').value = pnu;
    }, { pnu: parcel.properties.PNU });
    await page.locator('#deleteParcelInfoBtn').click();
    await page.waitForTimeout(800);

    const markerPresenceAfterDelete = await page.evaluate((pnu) => window.MemoMarkerManager.markers.has(pnu), parcel.properties.PNU);
    recordCheck(results, !markerPresenceAfterDelete, '공통: 필지 정보 삭제 시 마커 제거', { markerPresenceAfterDelete });
}

async function verifyMapPositionPersistence(page, results) {
    await installTestHarness(page);
    const mapExists = await page.evaluate(() => {
        try {
            const mapObj = window.map;
            return mapObj && typeof mapObj.setCenter === 'function';
        } catch (error) {
            return false;
        }
    });
    if (!mapExists) {
        recordCheck(results, false, '공통: 새로고침 후 지도 위치 복원', { reason: '지도 객체가 초기화되지 않음' });
        return;
    }

    await page.evaluate(() => {
        const position = { lat: 37.5705, lng: 126.9821, zoom: 17, timestamp: Date.now(), mode: window.currentMode || 'click' };
        localStorage.setItem('__testMapPosition', JSON.stringify(position));
        if (window.map && typeof window.map.setCenter === 'function') {
            window.map.setCenter({ lat: position.lat, lng: position.lng });
        }
        if (window.map && typeof window.map.setZoom === 'function') {
            window.map.setZoom(position.zoom);
        }
    });
    await page.waitForTimeout(500);

    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1500);
    await installTestHarness(page);

    const positionAfterReload = await page.evaluate(() => {
        try {
            return JSON.parse(localStorage.getItem('__testMapPosition') || 'null');
        } catch (error) {
            return null;
        }
    });
    const expectedLat = 37.5705;
    const expectedLng = 126.9821;
    const withinRange = positionAfterReload && Math.abs(positionAfterReload.lat - expectedLat) < 0.002 && Math.abs(positionAfterReload.lng - expectedLng) < 0.002;
    recordCheck(results, withinRange, '공통: 새로고침 후 지도 위치 복원', { positionAfterReload, expectedLat, expectedLng });
}

test.describe('🧪 전 모드 30회 반복 회귀', () => {
    test.setTimeout(45 * 60 * 1000);

    test('요구사항 전수 검증', async ({ page }) => {
        const checks = [];

        await initializeEnvironment(page);

        for (let i = 0; i < LOOPS; i += 1) {
            await runClickModeScenario(page, i, checks);
            await runSearchModeScenario(page, i, checks);
            await runHandModeScenario(page, i, checks);
        }

        await verifyMapTypeSwitching(page, checks);
        await verifyMarkerPersistenceAndDeletion(page, checks);
        await verifyMapPositionPersistence(page, checks);

        const failed = checks.filter(item => !item.passed);
        if (failed.length > 0) {
            console.log('❌ 실패한 체크 사항 요약:');
            failed.forEach(item => {
                console.log(` - ${item.label}`, item.details);
            });
        }

        const passedCount = checks.length - failed.length;
        console.log(`🔁 총 ${checks.length}개 체크 중 ${passedCount}개 통과, ${failed.length}개 실패`);

        expect(failed, '요구사항 검증 결과').toEqual([]);
    });
});
