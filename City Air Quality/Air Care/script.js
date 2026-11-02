const cityInput = document.getElementById("cityInput");
const searchForm = document.getElementById("searchForm");
const searchBtn = document.getElementById("searchBtn");
const message = document.getElementById("message");
const suggestions = document.getElementById("suggestions");

let selectedCity = null;

// Search Indian cities using Open-Meteo Geocoding API
async function searchCities(city) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=10&language=en&format=json&countryCode=IN`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Unable to search cities.");
    }

    const data = await response.json();

    return data.results || [];
}

// Display matching city suggestions
function displaySuggestions(cities) {
    suggestions.innerHTML = "";

    if (cities.length === 0) {
        message.textContent = "No matching Indian city found.";
        return;
    }

    cities.forEach(city => {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "suggestion-btn";

        button.textContent =
            `${city.name}${city.admin1 ? ", " + city.admin1 : ""}`;

        button.addEventListener("click", () => {
            selectedCity = city;
            cityInput.value = city.name;
            suggestions.innerHTML = "";
            loadCityData(city);
        });

        suggestions.appendChild(button);
    });

    if (cities.length === 1) {
        selectedCity = cities[0];
        loadCityData(cities[0]);
    } else {
        message.textContent = "Select your city from the matching results.";
    }
}

// Handle city search
searchForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const city = cityInput.value.trim();

    if (!city) {
        message.textContent = "Please enter a city name.";
        return;
    }

    searchBtn.disabled = true;
    searchBtn.textContent = "Searching...";
    message.textContent = "";
    suggestions.innerHTML = "";
    selectedCity = null;

    try {
        const cities = await searchCities(city);
        displaySuggestions(cities);
    } catch (error) {
        message.textContent = error.message;
    } finally {
        searchBtn.disabled = false;
        searchBtn.textContent = "Search City";
    }
});

// Calculate indicative Indian PM2.5 AQI sub-index
function calculatePM25AQI(value) {
    const ranges = [
        [0, 30, 0, 50],
        [31, 60, 51, 100],
        [61, 90, 101, 200],
        [91, 120, 201, 300],
        [121, 250, 301, 400],
        [251, 500, 401, 500]
    ];

    if (value < 0 || !Number.isFinite(value)) {
        return null;
    }

    if (value > 500) return 500;

    for (const [bpLow, bpHigh, aqiLow, aqiHigh] of ranges) {
        if (value >= bpLow && value <= bpHigh) {
            return Math.round(
                ((aqiHigh - aqiLow) / (bpHigh - bpLow)) *
                (value - bpLow) + aqiLow
            );
        }
    }

    return null;
}

// AQI category
function getAQICategory(aqi) {
    if (aqi <= 50) {
        return {
            name: "Good",
            color: "#5c9e15",
            background: "#dcfce7",
            advice: "Air quality is good. Normal outdoor activities are generally suitable."
        };
    }

    if (aqi <= 100) {
        return {
            name: "Satisfactory",
            color: "#65a30d",
            background: "#ecfccb",
            advice: "Air quality is generally acceptable. Unusually sensitive people should monitor their comfort."
        };
    }

    if (aqi <= 200) {
        return {
            name: "Moderate",
            color: "#d49b16",
            background: "#fef3c7",
            advice: "Sensitive people should consider reducing prolonged outdoor exertion."
        };
    }

    if (aqi <= 300) {
        return {
            name: "Poor",
            color: "#ea751b",
            background: "#ffedd5",
            advice: "Consider limiting prolonged outdoor exertion, especially if you are sensitive to air pollution."
        };
    }

    if (aqi <= 400) {
        return {
            name: "Very Poor",
            color: "#dc4545",
            background: "#fee2e2",
            advice: "Reduce outdoor exertion and follow local health advisories."
        };
    }

    return {
        name: "Severe",
        color: "#8b1c48",
        background: "#fce7f3",
        advice: "Avoid unnecessary outdoor exertion and follow official health guidance."
    };
}

// Get latest available current value
function getValue(data, key) {
    const value = data.current?.[key];

    return Number.isFinite(value) ? value : null;
}

// Format displayed values
function displayValue(value, digits = 1) {
    return value === null ? "--" : Number(value).toFixed(digits);
}

// Update an HTML element
function setText(id, value) {
    document.getElementById(id).textContent = value;
}

// Load air quality and weather data
async function loadCityData(city) {
    searchBtn.disabled = true;
    searchBtn.textContent = "Loading...";
    message.textContent = "Fetching air quality and weather information...";

    try {
        const latitude = city.latitude;
        const longitude = city.longitude;

        const airURL =
            `https://air-quality-api.open-meteo.com/v1/air-quality` +
            `?latitude=${latitude}&longitude=${longitude}` +
            `&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone` +
            `&timezone=auto`;

        const weatherURL =
            `https://api.open-meteo.com/v1/forecast` +
            `?latitude=${latitude}&longitude=${longitude}` +
            `&current=temperature_2m,relative_humidity_2m,wind_speed_10m` +
            `&timezone=auto`;

        const [airResponse, weatherResponse] = await Promise.all([
            fetch(airURL),
            fetch(weatherURL)
        ]);

        if (!airResponse.ok || !weatherResponse.ok) {
            throw new Error("Unable to fetch live data. Please try again.");
        }

        const [airData, weatherData] = await Promise.all([
            airResponse.json(),
            weatherResponse.json()
        ]);

        if (airData.error || weatherData.error) {
            throw new Error("The data service returned an error.");
        }

        updateDashboard(city, airData, weatherData);

        message.textContent = "";
    } catch (error) {
        message.textContent = error.message;
    } finally {
        searchBtn.disabled = false;
        searchBtn.textContent = "Search City";
    }
}

// Update dashboard with fetched information
function updateDashboard(city, air, weather) {
    const pm25 = getValue(air, "pm2_5");
    const pm10 = getValue(air, "pm10");
    const co = getValue(air, "carbon_monoxide");
    const no2 = getValue(air, "nitrogen_dioxide");
    const so2 = getValue(air, "sulphur_dioxide");
    const o3 = getValue(air, "ozone");

    const aqi = pm25 === null ? null : calculatePM25AQI(pm25);

    // City name
    setText(
        "cityName",
        `${city.name}, ${city.admin1 || "India"}`
    );

    // AQI
    if (aqi === null) {
        setText("aqiValue", "--");
        setText("aqiStatus", "Data unavailable");
        setText("healthAdvice", "PM2.5 data is currently unavailable.");
        setText("updatedTime", "Please try again later.");

        document.getElementById("aqiValue").style.color = "#64748b";
        document.getElementById("aqiBar").style.width = "0%";
        return;
    }

    const category = getAQICategory(aqi);

    setText("aqiValue", aqi);
    setText("aqiStatus", category.name);
    setText("healthAdvice", category.advice);

    const aqiValue = document.getElementById("aqiValue");
    const status = document.getElementById("aqiStatus");

    aqiValue.style.color = category.color;
    status.style.color = category.color;
    status.style.background = category.background;

    document.getElementById("aqiBar").style.width =
        `${Math.min(aqi / 500 * 100, 100)}%`;

    document.getElementById("aqiBar").style.background =
        category.color;

    setText(
        "updatedTime",
        `Model data time: ${air.current?.time || "Not available"}`
    );

    // Weather information
    const currentWeather = weather.current || {};

    setText(
        "temperature",
        displayValue(currentWeather.temperature_2m) + " °C"
    );

    setText(
        "humidity",
        displayValue(currentWeather.relative_humidity_2m, 0) + "%"
    );

    setText(
        "wind",
        displayValue(currentWeather.wind_speed_10m) + " km/h"
    );

    setText("pm25", displayValue(pm25) + " µg/m³");

    // Pollutants
    setText("pm10", displayValue(pm10));
    setText("pm25detail", displayValue(pm25));
    setText("co", displayValue(co));
    setText("no2", displayValue(no2));
    setText("so2", displayValue(so2));
    setText("o3", displayValue(o3));
}

// Load a default Indian city on opening the website
async function initializeDashboard() {
    try {
        const cities = await searchCities("Ahmedabad");

        const ahmedabad = cities.find(
            city => city.name.toLowerCase() === "ahmedabad"
        );

        if (ahmedabad) {
            cityInput.value = ahmedabad.name;
            await loadCityData(ahmedabad);
        }
    } catch (error) {
        message.textContent =
            "Enter a city name and press Search City to begin.";
    }
}

initializeDashboard();