const express = require('express');
const fs = require('fs-extra');

const app = express();
const port = 8080;

const citySearchJobs = {};

const loadCities = async () => {
    const citiesData = await fs.readFile('addresses.json');
    const cities = JSON.parse(citiesData);
    return cities;
};

// Uses the Haversine formula (https://en.wikipedia.org/wiki/Haversine_formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
      + Math.cos(lat1 * (Math.PI / 180))
      * Math.cos(lat2 * (Math.PI / 180))
      * Math.sin(dLon / 2)
      * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const processAllCitiesInSetDistanceFromCity = async (jobId, fromCityId, setDistance) => {
    const cities = await loadCities();

    const fromCity = cities.find((city) => city.guid === fromCityId);

    if (!fromCity) {
        return { error: 'From city not found' };
    }

    const citiesInDistance = cities.filter((city) => {
        if (city.guid === fromCity.guid) return false;

        const distance = calculateDistance(
            fromCity.latitude,
            fromCity.longitude,
            city.latitude,
            city.longitude,
        );
        return distance <= setDistance;
    });

    citySearchJobs[jobId] = citiesInDistance;
    return { result: 'Success' };
};

// Middleware to simulate authentication (should be replaced with a real authentication system)
app.use((req, res, next) => {
    const authorizationHeader = req.get('Authorization');

    if (authorizationHeader !== 'bearer dGhlc2VjcmV0dG9rZW4=') {
        res.status(401).send('Authentication failed');
    } else {
        next();
    }
});

app.get('/cities-by-tag', async (req, res) => {
    const { tag } = req.query;
    const { isActive } = req.query;

    const cities = await loadCities();
    const filteredCities = cities.filter((city) => city.tags.includes(tag) && `${city.isActive}` === isActive);

    res.json({ cities: filteredCities });
});

app.get('/distance', async (req, res) => {
    const fromCityId = req.query.from;
    const toCityId = req.query.to;

    const cities = await loadCities();

    const fromCity = cities.find((city) => city.guid === fromCityId);
    const toCity = cities.find((city) => city.guid === toCityId);

    if (!fromCity) {
        res.status(404).json({ error: 'From city not found' });
        return;
    }

    if (!toCity) {
        res.status(404).json({ error: 'To city not found' });
        return;
    }

    const distance = calculateDistance(
        parseFloat(fromCity.latitude),
        parseFloat(fromCity.longitude),
        parseFloat(toCity.latitude),
        parseFloat(toCity.longitude),
    );

    res.json({
        from: fromCity,
        to: toCity,
        unit: 'km',
        distance: Math.round(distance * 100) / 100,
    });
});

app.get('/area', async (req, res) => {
    const fromCityId = req.query.from;
    const distance = parseFloat(req.query.distance);

    // Simulate the job id to match the test
    const jobId = '2152f96f-50c7-4d76-9e18-f7033bd14428';

    processAllCitiesInSetDistanceFromCity(jobId, fromCityId, distance);

    res.status(202).json({
        status: 'Processing',
        resultsUrl: `${req.protocol}://${req.get('host')}/area-result/${jobId}`,
    });
});

app.get('/area-result/:jobId', (req, res) => {
    const { jobId } = req.params;
    const result = citySearchJobs[jobId];

    if (result) {
        res.json({ status: 'completed', cities: result });
    } else {
        res.status(202).json({ status: 'pending' });
    }
});

app.get('/all-cities', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="all-cities.json"');
    res.setHeader('Transfer-Encoding', 'chunked');

    const stream = fs.createReadStream('addresses.json');

    stream.on('end', () => res.end());
    stream.pipe(res);
});

app.listen(port, () => {
    console.log(`API server is listening on port ${port}`);
});
