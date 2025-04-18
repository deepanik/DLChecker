let searchHistory = [];
let isProcessing = false;
let vehicleNumberQueue = [];
let currentIndex = 0;
let maxRetries = 3;
let delayBetweenRequests = 1000; // 1 second delay between requests

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
}

function maskOwnerName(name) {
    return name || 'N/A';
}

function addToHistory(vehicleData) {
    const data = vehicleData.vehicleData.value;
    
    // Check if this registration number already exists in history
    const isDuplicate = searchHistory.some(item => 
        item.registration_number === data.registration_number
    );
    
    // Only add if it's not a duplicate
    if (!isDuplicate) {
        searchHistory.unshift(data);
        if (searchHistory.length > 10) { // Keep only last 10 entries
            searchHistory.pop();
        }
    }
    
    updateHistoryTable();
}

function updateHistoryTable() {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const filteredData = applyFilters(searchHistory);
    
    filteredData.forEach(data => {
        const row = createTableRow(data);
        tbody.appendChild(row);
    });

    // Update result count
    const resultCount = document.getElementById('resultCount');
    if (resultCount) {
        resultCount.textContent = `Showing ${filteredData.length} of ${searchHistory.length} results`;
    }
}

function createTableRow(data) {
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${data.registration_number || 'N/A'}</td>
        <td>${data.vehicle_type_v2 || 'N/A'}</td>
        <td>${data.vehicle_name || 'N/A'}</td>
        <td>${data.model_name || 'N/A'}</td>
        <td>${data.fuel_type || 'N/A'}</td>
        <td>${maskOwnerName(data.owner_name)}</td>
        <td>${formatDate(data.previous_policy_expiry_date)}</td>
    `;
    return row;
}

function filterByVehicleType(data) {
    const filterSelect = document.getElementById('vehicleTypeFilter');
    if (!filterSelect) return data;
    const selectedType = filterSelect.value;
    if (!selectedType) return data;
    return data.filter(item => item.vehicle_type_v2 === selectedType);
}

async function checkVehicle() {
    const vehicleNumber = document.getElementById('vehicleNumber').value;
    if (!vehicleNumber) {
        alert('Please enter a vehicle number');
        return;
    }

    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = '<p class="loading">Loading...</p>';

    try {
        const data = await checkVehicleWithRetry(vehicleNumber);
        displayResult(data);
    } catch (error) {
        resultDiv.innerHTML = `<div class="error-message">
            Error: ${error.message}
            <button class="retry-button" onclick="retryVehicle('${vehicleNumber}')">Retry</button>
        </div>`;
    }
}

// Add cookie display functionality
async function updateCookiesDisplay() {
    try {
        const response = await fetch('/cookies-count');
        const data = await response.json();
        
        const cookiesStatus = document.getElementById('cookiesStatus');
        if (cookiesStatus) {
            cookiesStatus.innerHTML = `
                <div class="cookies-info">
                    <span>Active Cookies: ${data.count}</span>
                    <button onclick="showCookiesList()" class="view-cookies-btn">View Cookies</button>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error updating cookies display:', error);
    }
}

// Function to show cookies list
async function showCookiesList() {
    try {
        const response = await fetch('/list-cookies');
        const data = await response.json();
        
        let cookiesList = data.cookies.map((cookie, index) => 
            `${index + 1}. ${cookie.cookie.substring(0, 50)}...`
        ).join('\n');

        alert(`Current Cookies:\n\n${cookiesList}`);
    } catch (error) {
        alert('Error fetching cookies list: ' + error.message);
    }
}

// Update the addCookie function
async function addCookie() {
    const cookieInput = document.getElementById('newCookie');
    let token = cookieInput.value.trim();
    
    if (!token) {
        alert('Please enter a token');
        return;
    }

    // Format the token into the proper cookie structure
    const formattedCookie = `user_id=${token}`;

    try {
        const response = await fetch('/add-cookie', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ cookie: formattedCookie })
        });

        const data = await response.json();
        if (data.success) {
            alert('Cookie successfully added');
            cookieInput.value = '';
            await updateCookiesDisplay(); // Add await here
        } else {
            alert('Failed to add cookie: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Error adding cookie: ' + error.message);
    }
}

// Add function to initialize the page
async function initializePage() {
    await updateCookiesDisplay();
}

// Call initializePage when the document loads
document.addEventListener('DOMContentLoaded', initializePage);

// Update validation function for token format
function validateToken(token) {
    // Check if it's a JWT-like string (base64 encoded segments)
    const jwtPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
    return jwtPattern.test(token);
}

// Add function to display cookie format example
function showCookieFormatExample() {
    const example = 'user_id=5rwp_u1rcjyVnshKuM7k-g:1745014534339:cbed19a59ea7e5524f093f528ed63ccc2e8cca12';
    alert('Cookie format example:\n\n' + example + '\n\nFormat: user_id=USERNAME:TIMESTAMP:HASH');
}

// Add function to get cookies count
async function getCookiesCount() {
    try {
        const response = await fetch('/cookies-count');
        const data = await response.json();
        return data.count;
    } catch (error) {
        console.error('Error getting cookies count:', error);
        return 0;
    }
}

// Advanced Filtering
function getFilters() {
    return {
        vehicleType: document.getElementById('vehicleTypeFilter').value,
        fuelType: document.getElementById('fuelTypeFilter').value,
        model: document.getElementById('modelFilter').value.toLowerCase(),
        manufacturer: document.getElementById('manufacturerFilter').value.toLowerCase(),
        policyExpiryFrom: document.getElementById('policyExpiryFrom').value,
        policyExpiryTo: document.getElementById('policyExpiryTo').value
    };
}

function applyFilters(data) {
    const filters = getFilters();
    
    return data.filter(item => {
        const matchesVehicleType = !filters.vehicleType || item.vehicle_type_v2 === filters.vehicleType;
        const matchesFuelType = !filters.fuelType || item.fuel_type === filters.fuelType;
        const matchesModel = !filters.model || item.model_name.toLowerCase().includes(filters.model);
        const matchesManufacturer = !filters.manufacturer || item.vehicle_name.toLowerCase().includes(filters.manufacturer);
        
        let matchesPolicyExpiry = true;
        if (filters.policyExpiryFrom || filters.policyExpiryTo) {
            const policyDate = new Date(item.previous_policy_expiry_date);
            if (filters.policyExpiryFrom) {
                matchesPolicyExpiry = matchesPolicyExpiry && policyDate >= new Date(filters.policyExpiryFrom);
            }
            if (filters.policyExpiryTo) {
                matchesPolicyExpiry = matchesPolicyExpiry && policyDate <= new Date(filters.policyExpiryTo);
            }
        }

        return matchesVehicleType && matchesFuelType && matchesModel && 
               matchesManufacturer && matchesPolicyExpiry;
    });
}

function clearFilters() {
    document.getElementById('vehicleTypeFilter').value = '';
    document.getElementById('fuelTypeFilter').value = '';
    document.getElementById('modelFilter').value = '';
    document.getElementById('manufacturerFilter').value = '';
    document.getElementById('policyExpiryFrom').value = '';
    document.getElementById('policyExpiryTo').value = '';
    updateHistoryTable();
}

// Excel Download
async function downloadExcel() {
    const filteredData = applyFilters(searchHistory);
    const filters = getFilters();

    try {
        const response = await fetch('/download-excel', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                data: filteredData,
                filters: filters
            })
        });

        if (!response.ok) throw new Error('Download failed');

        // Create blob and download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'vehicle_data.xlsx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        alert('Error downloading Excel: ' + error.message);
    }
}

// Add event listeners for filter changes
document.addEventListener('DOMContentLoaded', () => {
    const filterElements = [
        'vehicleTypeFilter',
        'fuelTypeFilter',
        'modelFilter',
        'manufacturerFilter',
        'policyExpiryFrom',
        'policyExpiryTo'
    ];

    filterElements.forEach(elementId => {
        const element = document.getElementById(elementId);
        if (element) {
            element.addEventListener('change', updateHistoryTable);
            if (element.tagName === 'INPUT' && element.type === 'text') {
                element.addEventListener('keyup', updateHistoryTable);
            }
        }
    });
});

// Bulk upload and processing functions
async function startBulkCheck() {
    const fileInput = document.getElementById('dlFile');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Please select a file first');
        return;
    }

    try {
        const text = await file.text();
        vehicleNumberQueue = text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        if (vehicleNumberQueue.length === 0) {
            alert('No valid vehicle numbers found in file');
            return;
        }

        isProcessing = true;
        currentIndex = 0;
        updateBulkControls(true);
        processBulkQueue();
    } catch (error) {
        alert('Error reading file: ' + error.message);
    }
}

function stopBulkCheck() {
    isProcessing = false;
    updateBulkControls(false);
}

function updateBulkControls(processing) {
    const startBtn = document.querySelector('.bulk-check-btn');
    const stopBtn = document.querySelector('.bulk-stop-btn');
    const fileInput = document.getElementById('dlFile');

    startBtn.disabled = processing;
    stopBtn.disabled = !processing;
    fileInput.disabled = processing;
}

function updateProgress() {
    const progressCount = document.getElementById('progressCount');
    const progressFill = document.getElementById('progressFill');
    const progress = (currentIndex / vehicleNumberQueue.length) * 100;

    progressCount.textContent = `Processing: ${currentIndex}/${vehicleNumberQueue.length}`;
    progressFill.style.width = `${progress}%`;
}

async function processBulkQueue() {
    if (!isProcessing || currentIndex >= vehicleNumberQueue.length) {
        updateBulkControls(false);
        if (currentIndex >= vehicleNumberQueue.length) {
            alert('Bulk processing completed!');
        }
        return;
    }

    const vehicleNumber = vehicleNumberQueue[currentIndex];
    try {
        await checkVehicleWithRetry(vehicleNumber);
        currentIndex++;
        updateProgress();
        
        // Add delay between requests
        setTimeout(() => {
            processBulkQueue();
        }, delayBetweenRequests);
    } catch (error) {
        handleBulkError(error, vehicleNumber);
    }
}

async function checkVehicleWithRetry(vehicleNumber, retryCount = 0) {
    try {
        const proxyInput = document.getElementById('proxyInput').value;
        const response = await fetch('/check-vehicle', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                vehicleNumber,
                proxy: proxyInput
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }

        // Add to search history if successful
        if (data.success && data.vehicleData.status === 'fulfilled') {
            addToHistory(data);
            updateHistoryTable();
        }

        return data;
    } catch (error) {
        if (retryCount < maxRetries) {
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
            return checkVehicleWithRetry(vehicleNumber, retryCount + 1);
        }
        throw error;
    }
}

function handleBulkError(error, vehicleNumber) {
    const resultDiv = document.getElementById('result');
    const errorMessage = `Error checking ${vehicleNumber}: ${error.message}`;
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        ${errorMessage}
        <button class="retry-button" onclick="retryVehicle('${vehicleNumber}')">Retry</button>
    `;
    
    resultDiv.insertBefore(errorDiv, resultDiv.firstChild);
    
    // Continue with next vehicle after error
    currentIndex++;
    updateProgress();
    setTimeout(() => {
        processBulkQueue();
    }, delayBetweenRequests);
}

async function retryVehicle(vehicleNumber) {
    try {
        await checkVehicleWithRetry(vehicleNumber);
        // Remove error message if successful
        const errorMessages = document.querySelectorAll('.error-message');
        errorMessages.forEach(msg => {
            if (msg.textContent.includes(vehicleNumber)) {
                msg.remove();
            }
        });
    } catch (error) {
        alert(`Retry failed for ${vehicleNumber}: ${error.message}`);
    }
}

function displayResult(data) {
    const resultDiv = document.getElementById('result');
    const resultTable = document.getElementById('resultTable');
    
    if (data.error) {
        resultDiv.innerHTML = `<p class="error">Error: ${data.error}</p>`;
        return;
    }

    if (data.success && data.vehicleData.status === 'fulfilled') {
        const vehicleInfo = data.vehicleData.value;
        addToHistory(data);
        
        const tbody = document.getElementById('resultTableBody');
        if (tbody) {
            tbody.innerHTML = '';
            tbody.appendChild(createTableRow(vehicleInfo));
        }
        
        if (resultTable) {
            resultTable.style.display = 'table';
        }
        resultDiv.innerHTML = '';
    } else {
        resultDiv.innerHTML = '<p class="error">No data found for this vehicle</p>';
    }
}

function showTokenFormatExample() {
    const example = `Example token format:
eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...

The system will automatically add "user_id=" prefix when saving.`;
    alert(example);
} 