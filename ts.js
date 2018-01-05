let api = {
    minutes2Hours: function (mins) {
        if (mins > 60) {
            let hours = Math.floor(mins/60);
            let minutes = mins - (hours * 60);
            let ordinal = hours > 1 ? "s": "";
            return `${hours} hour${ordinal}, ${minutes}`;
        }
        else {
            return "the duration in minutes";
        }
    },

    timeKey: function (time) { // make a sortable key out of time, a Date
        if (time === undefined) {
            time = new Date();
        }

        let now = new Date();
        
        let year = time.getFullYear();
        let month = time.getMonth() + 1;
        let day = time.getDay();
        let hours = time.getHours();
        let mins = time.getMinutes();
        let secs = time.getSeconds();

        let nowMs = now.valueOf();

        return `${year
}-${month < 10 ? "0" + month : month
}-${day < 10 ? "0" + day : day
}T${hours < 10 ? "0" + hours : hours
}:${mins < 10 ? "0" + mins : mins
}:${secs < 10 ? "0" + secs : secs
}#${nowMs < 10 ? "0" + nowMs : nowMs}`;
    },

    formDate: function (time) {
        if (time === undefined) {
            time = new Date();
        }

        let year = time.getFullYear();
        let month = time.getMonth() + 1;
        let day = time.getDay();

        return `${year
}-${month < 10 ? "0" + month : month
}-${day < 10 ? "0" + day : day}`;
    },

    getStorage: function (key) {
        let objStr = window.localStorage.getItem(key);
        if (objStr == undefined) {
            objStr = "{}";
        }
        let obj = JSON.parse(objStr);
        let sortedKeys = Object.keys(obj).sort();
        let returnObj = {};
        sortedKeys.reverse().forEach(k => returnObj[k] = obj[k]);
        return returnObj;
    },

    makeTableRow: function (obj, key) {
        let tableRow = document.createElement("tr");
        tableRow.setAttribute("data-key", key);
        tableRow.innerHTML = `<td>${obj.reason}</td>
<td>${obj.duration}</td>
<td data-order='${obj.when}'>${obj.when}</td>`;
        document.importNode(tableRow);
        let table = document.querySelector("tbody");
        if (table.children.length > 0) {
            table.insertBefore(tableRow, table.firstChildElement);
        }
        else {
            table.appendChild(tableRow);
        }
    },

    saveData: function (obj) {
        let {duration, reason, when} = obj;
        let storage = api.getStorage("timekeep");

        let key = api.timeKey(new Date(when));
        storage[key] = obj;

        window.localStorage.setItem("timekeep", JSON.stringify(storage));

        api.makeTableRow(obj, key);
    },

    formInit: function (formObject, date) {
        formObject.elements.when.value
            = (date == undefined) ? api.formDate() : api.formDate(date);

        formObject.elements.duration.addEventListener("change", evt => {
            let val = parseInt(evt.target.value);
            let timeFmt = api.minutes2Hours(val);
            evt.target.title = timeFmt;
            document.querySelector("#duration").textContent = timeFmt;
        });

        formObject.addEventListener("submit", evt => {
            evt.preventDefault();

            let duration = evt.target.elements.duration.value;
            let reason = evt.target.elements.reason.value;
            let when = evt.target.elements.when.value;
            let obj = {
                duration: duration,
                reason: reason,
                when: when
            };
            api.saveData(obj);

            let formContainer = formObject.parentElement;
            formContainer
                .parentElement
                .removeChild(formContainer);
            return false;
        });
    },

    monthDays: function (d) {
        // https://www.timeanddate.com/date/leapyear.html
        let leapYear4YearRule = d.getFullYear() % 4 == 0;
        let leapYear100YearRule = d.getFullYear() % 100 == 0;
        let leapYear400YearRule = d.getFullYear() % 400 == 0;
        let leapYear = (leapYear4YearRule && !leapYear100YearRule)
            || leapYear400YearRule;
        let febDays = leapYear ? 29 : 28;
        let months = [31, febDays, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        return months;
    },

    week: function (d) { // return array of d's week's dates so far
        let days = api.monthDays(d);
        let month = d.getMonth();

        let previous = (month < 1) ? [0] : days.slice(0, month);
        let previousTotal = previous.reduce((a, c) => a + c);

        let date = d.getDate();
        let daysSoFar = previousTotal + date;
        let weekNumber = Math.floor(daysSoFar / 7);
        let weekDay = daysSoFar % 7;
        let startOfWeek = daysSoFar - weekDay;
        let weekDays = [...new Array(weekDay).keys()];
        let weekDayDates = weekDays.map(i => startOfWeek + i - previousTotal + 1);
        let weekDates = weekDayDates.map(day => {
            let dateStr = d.getFullYear()
                + "-" + (d.getMonth() + 1)
                + "-" + (day < 10 ? "0" + day : day);
            return new Date(dateStr);
        });
        return weekDates;
    },

    thisWeekDays: function () {
        return api.week(new Date());
    },

    dayDateToLong: function (dayDate) {
        let days = ["Sun",
                    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday",
                    "Sat"];
        let date = new Date(dayDate);
        let weekIndex = date.getDay();
        let weekDay = days[weekIndex];
        return weekDay;
    },

    // send notifies if a notify of the same clasz has not been sent in 10 secs
    sendNotify: function (clasz, message) {
        let now = new Date().valueOf();

        try {
            let notifyStorage = api.getStorage("notifies");
            let thisClasz = notifyStorage[clasz];
            let ignoreSeconds = 1000 * 60 * 15;

            if (thisClasz == undefined) {
                thisClasz = { sentTime: now - ignoreSeconds - 1 };
            }

            console.log("sendNotify last time", thisClasz.sentTime + ignoreSeconds, now);
            if (thisClasz.sentTime + ignoreSeconds < now) {
                new Notification(message);
                notifyStorage[clasz] = { sentTime: now, message: message };
                window
                    .localStorage
                    .setItem("notifies", JSON.stringify(notifyStorage));
            }
        }
        catch (e) {
            console.log("e", e);
        }
    },

    stored: function (timeKeep) {
        let expectedTime = 60 * 7;
        let weekDates = api.thisWeekDays();
        let badDateList = new Array();
        let dateRecordedTimes = weekDates.map(day => {
            let today = api.formDate(day);

            let todayList = Object.keys(timeKeep).filter(k => k.startsWith(today));
            // console.log("api.stored - todayList", today, todayList);
            let totalTime = 0;
            if (todayList.length > 0) {
                let durations = todayList.map(k => parseInt(timeKeep[k].duration));
                totalTime = durations.reduce((a, c) => a + c);
            }
            console.log("api.stored - computing expected-total",
                        today, expectedTime - totalTime);

            let remainingTime = expectedTime - totalTime;
            if (remainingTime > 0) {
                badDateList.push(today);
            }
            return remainingTime;
        });

        let badDates = dateRecordedTimes.filter(e => e > 0);

        if (badDates.length > 0) {
            console.log("api.stored - at least one missing time record");
            let todayIndex = badDates.length - 1;
            let timeDiff = badDates[todayIndex];
            let template = document.querySelector("#entryform");
            let badDay = badDateList[todayIndex];
            let weekDay = api.dayDateToLong(badDay);
            let notification
                = `you have ${timeDiff} minutes to record for ${weekDay}, ${badDay}`;

            // Put the form up if it's not there
            if (document.querySelector("#entry") == undefined) {
                let formMessage = template.content.querySelector("#remainingMessage");
                formMessage.textContent = notification; 

                let clone = document.importNode(template.content, true);
                let targetElement = document.body.firstElementChild;
                targetElement.parentElement.insertBefore(clone, targetElement);
                let form = document.querySelector("#entry");
                api.formInit(form, new Date(badDay));
            }

            // Send notifications if it's been a while since we sent one
            if (Notification.permission === "granted") {
                api.sendNotify("time", notification);
            }
            else if (Notification.persmission !== "denied") {
                Notification.requestPermission(permission => {
                    if (permission === "granted") {
                        api.sendNotify("time", notification);
                    }
                });
            }
        }
    },

    cron: function () {
        console.log("cron");
        let storage = api.getStorage("timekeep");
        api.stored(storage);
    },

    cronOff: function () {
        window.clearInterval(window.myintervalid);
    },

    init: function () {
        // get the list
        let storage = api.getStorage("timekeep");
        Object.keys(storage).forEach(key => {
            api.makeTableRow(storage[key], key);
        });
        api.stored(storage);
        window.myintervalid = window.setInterval(api.cron, 5000);
        window.myapi = api;
    }
};

export default api;

// ts.js ends here
