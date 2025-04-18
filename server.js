const express = require('express');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const HttpsProxyAgent = require('https-proxy-agent');
const ExcelJS = require('exceljs');

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('.'));

// Function to read cookies from cookies.js
async function getRandomCookie() {
    try {
        const cookiesData = await fs.readFile('cookies.js', 'utf8');
        const cookies = JSON.parse(cookiesData);
        if (cookies.length === 0) return '';
        const randomCookie = cookies[Math.floor(Math.random() * cookies.length)];
        return randomCookie.cookie;
    } catch (error) {
        console.error('Error reading cookies:', error);
        return '';
    }
}

// Add cookie validation on the server side
function validateCookie(cookie) {
    const cookiePattern = /^user_id=[a-zA-Z0-9_-]+:[0-9]+:[a-zA-Z0-9]+$/;
    return cookiePattern.test(cookie);
}

// Update the add-cookie endpoint
app.post('/add-cookie', async (req, res) => {
    try {
        const { cookie } = req.body;
        if (!cookie) {
            return res.status(400).json({ error: 'Cookie is required' });
        }

        // Read existing cookies
        let cookiesData = await fs.readFile('cookies.js', 'utf8');
        let cookies = [];
        
        try {
            cookies = JSON.parse(cookiesData);
        } catch (parseError) {
            cookies = [];
        }

        // Check for duplicates
        const isDuplicate = cookies.some(c => c.cookie === cookie);
        if (isDuplicate) {
            return res.status(400).json({ error: 'This cookie already exists' });
        }

        // Add new cookie
        cookies.push({ cookie });

        // Write back to cookies.js with proper formatting
        await fs.writeFile(
            'cookies.js', 
            JSON.stringify(cookies, null, 4),
            'utf8'
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Generate Excel file
app.post('/download-excel', async (req, res) => {
    try {
        const { data, filters } = req.body;
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Vehicle Data');
        
        worksheet.columns = [
            { header: 'Registration Number', key: 'registration_number', width: 20 },
            { header: 'Vehicle Type', key: 'vehicle_type_v2', width: 15 },
            { header: 'Vehicle Name', key: 'vehicle_name', width: 15 },
            { header: 'Model Name', key: 'model_name', width: 30 },
            { header: 'Fuel Type', key: 'fuel_type', width: 15 },
            { header: 'Owner Name', key: 'owner_name', width: 20 },
            { header: 'Policy Expiry', key: 'policy_expiry', width: 15 },
            { header: 'Applied Filters', key: 'filters', width: 30 }
        ];

        // Add filter information
        worksheet.addRow({
            registration_number: 'Applied Filters:',
            vehicle_type_v2: JSON.stringify(filters)
        });
        worksheet.addRow({}); // Empty row for spacing

        // Add data
        data.forEach(item => {
            worksheet.addRow(item);
        });

        // Style the header
        worksheet.getRow(1).font = { bold: true };
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=vehicle_data.xlsx');
        
        await workbook.xlsx.write(res);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update the check-vehicle endpoint
app.post('/check-vehicle', async (req, res) => {
    try {
        const { vehicleNumber, proxy } = req.body;
        const cookie = await getRandomCookie();

        if (!cookie) {
            return res.status(400).json({ error: 'No valid cookies available' });
        }

        let config = {
            headers: {
                'Cookie': cookie
            },
            timeout: 10000 // 10 second timeout
        };

        if (proxy) {
            const [ip, port, username, password] = proxy.split(':');
            const proxyUrl = `http://${username}:${password}@${ip}:${port}`;
            config.httpsAgent = new HttpsProxyAgent(proxyUrl);
        }

        try {
            const response = await axios.get(
                `https://www.acko.com/api/seo/challanService/${vehicleNumber}/?pageType=rtoPage`,
                config
            );
            res.json(response.data);
        } catch (axiosError) {
            if (axiosError.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                res.status(axiosError.response.status).json({
                    error: `API Error: ${axiosError.response.status} - ${axiosError.response.statusText}`,
                    details: axiosError.response.data
                });
            } else if (axiosError.request) {
                // The request was made but no response was received
                res.status(504).json({
                    error: 'No response received from API server',
                    details: 'Request timeout or network error'
                });
            } else {
                // Something happened in setting up the request
                res.status(500).json({
                    error: 'Request setup error',
                    details: axiosError.message
                });
            }
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add endpoint to list cookies
app.get('/list-cookies', async (req, res) => {
    try {
        const cookiesData = await fs.readFile('cookies.js', 'utf8');
        const cookies = JSON.parse(cookiesData);
        res.json({ cookies });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add endpoint to get cookies count
app.get('/cookies-count', async (req, res) => {
    try {
        const cookiesData = await fs.readFile('cookies.js', 'utf8');
        const cookies = JSON.parse(cookiesData);
        res.json({ count: cookies.length });
    } catch (error) {
        res.json({ count: 0 });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 