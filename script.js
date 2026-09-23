const $ = id => document.getElementById(id);

const fa = n =>
    String(n).replace(
        /\d/g,
        d => "۰۱۲۳۴۵۶۷۸۹"[d]
    );

const months = [
    "فروردین",
    "اردیبهشت",
    "خرداد",
    "تیر",
    "مرداد",
    "شهریور",
    "مهر",
    "آبان",
    "آذر",
    "دی",
    "بهمن",
    "اسفند"
];

const week = [
    "شنبه",
    "یکشنبه",
    "دوشنبه",
    "سه‌شنبه",
    "چهارشنبه",
    "پنجشنبه",
    "جمعه"
];

let records =
    JSON.parse(
        localStorage.getItem("mahi_work") || "[]"
    );

let selected = null;

let calendar = null;

let editIndex = -1;


/* =========================================================
   تبدیل میلادی به شمسی
========================================================= */

function gregorianToJalali(gy, gm, gd){

    const gDays = [
        31,28,31,30,31,30,
        31,31,30,31,30,31
    ];

    let gy2 = gy - 1600;

    let days =
        365 * gy2
        + Math.floor((gy2 + 3) / 4)
        - Math.floor((gy2 + 99) / 100)
        + Math.floor((gy2 + 399) / 400);

    for(let i = 0; i < gm - 1; i++){
        days += gDays[i];
    }

    if(
        gm > 2 &&
        (
            gy % 4 === 0 &&
            gy % 100 !== 0 ||
            gy % 400 === 0
        )
    ){
        days++;
    }

    days += gd - 1;

    let jDays = days - 79;

    let cycle = Math.floor(jDays / 12053);

    jDays %= 12053;

    let jy =
        979 +
        cycle * 33 +
        Math.floor(jDays / 1461) * 4;

    jDays %= 1461;

    if(jDays >= 366){

        jy += Math.floor(
            (jDays - 1) / 365
        );

        jDays =
            (jDays - 1) % 365;
    }

    let jm;

    let jd;

    if(jDays < 186){

        jm =
            1 +
            Math.floor(jDays / 31);

        jd =
            1 +
            jDays % 31;

    }else{

        jm =
            7 +
            Math.floor(
                (jDays - 186) / 30
            );

        jd =
            1 +
            (jDays - 186) % 30;
    }

    return [
        jy,
        jm,
        jd
    ];
}


/* =========================================================
   تبدیل شمسی به میلادی
========================================================= */

function jalaliToGregorian(jy, jm, jd){

    let jy2 = jy - 979;

    let days =
        365 * jy2 +
        Math.floor(jy2 / 33) * 8 +
        Math.floor(
            (jy2 % 33 + 3) / 4
        );

    if(jm <= 6){

        days +=
            (jm - 1) * 31;

    }else{

        days +=
            (jm - 7) * 30 +
            186;
    }

    days += jd - 1;

    let gDays = days + 79;

    let gy =
        1600 +
        400 *
        Math.floor(
            gDays / 146097
        );

    gDays %= 146097;

    let leap = true;

    if(gDays >= 36525){

        gDays--;

        gy +=
            100 *
            Math.floor(
                gDays / 36524
            );

        gDays %= 36524;

        if(gDays >= 365){

            gDays++;
            leap = false;
        }
    }

    gy +=
        4 *
        Math.floor(
            gDays / 1461
        );

    gDays %= 1461;

    if(gDays >= 366){

        leap = false;

        gDays--;

        gy +=
            Math.floor(
                gDays / 365
            );

        gDays %= 365;
    }

    const monthDays = [
        31,
        leap ? 29 : 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31
    ];

    let gm = 0;

    let gd = gDays + 1;

    while(
        gd > monthDays[gm]
    ){

        gd -= monthDays[gm];

        gm++;
    }

    return new Date(
        gy,
        gm,
        gd
    );
}


/* =========================================================
   امروز
========================================================= */

function getTodayJalali(){

    const d = new Date();

    const j =
        gregorianToJalali(
            d.getFullYear(),
            d.getMonth() + 1,
            d.getDate()
        );

    return {
        y:j[0],
        m:j[1],
        d:j[2]
    };
}


/* =========================================================
   تعداد روز ماه شمسی
========================================================= */

function daysInJalaliMonth(y,m){

    if(m <= 6){

        return 31;
    }

    if(m <= 11){

        return 30;
    }

    const next =
        jalaliToGregorian(
            y,
            12,
            30
        );

    const check =
        gregorianToJalali(
            next.getFullYear(),
            next.getMonth() + 1,
            next.getDate()
        );

    if(
        check[0] === y &&
        check[1] === 12 &&
        check[2] === 30
    ){

        return 30;
    }

    return 29;
}


/* =========================================================
   روز هفته
========================================================= */

function getWeekday(y,m,d){

    const date =
        jalaliToGregorian(
            y,
            m,
            d
        );

    return week[
        (date.getDay() + 1) % 7
    ];
}


/* =========================================================
   انتخاب تاریخ
========================================================= */

function selectDate(y,m,d){

    selected = [
        y,
        m,
        d
    ];

    $("dateBtn").textContent =
        `${fa(y)}/${fa(
            String(m).padStart(2,"0")
        )}/${fa(
            String(d).padStart(2,"0")
        )}`;

    $("dayDisplay").textContent =
        getWeekday(y,m,d);

    $("calendarModal")
        .classList
        .remove("show");
}


/* =========================================================
   نمایش تقویم
========================================================= */

function renderCalendar(){

    const y = calendar.y;

    const m = calendar.m;

    $("monthName").textContent =
        months[m - 1];

    $("yearName").textContent =
        fa(y);


    const first =
        jalaliToGregorian(
            y,
            m,
            1
        );


    /*
      در جاوااسکریپت:
      Sunday = 0
      Monday = 1
      ...
      Saturday = 6

      تقویم ما از شنبه شروع می‌شود.
    */

    const offset =
        (first.getDay() + 1) % 7;


    const total =
        daysInJalaliMonth(
            y,
            m
        );


    const container =
        $("days");

    container.innerHTML = "";


    /* خانه‌های خالی ابتدای ماه */

    for(
        let i = 0;
        i < offset;
        i++
    ){

        const empty =
            document.createElement("span");

        empty.className =
            "empty-day";

        container.appendChild(
            empty
        );
    }


    /* روزهای ماه */

    for(
        let d = 1;
        d <= total;
        d++
    ){

        const button =
            document.createElement("button");

        button.type = "button";

        button.textContent =
            fa(d);


        if(
            selected &&
            selected[0] === y &&
            selected[1] === m &&
            selected[2] === d
        ){

            button.classList.add(
                "selected"
            );
        }


        const today =
            getTodayJalali();


        if(
            today.y === y &&
            today.m === m &&
            today.d === d
        ){

            button.classList.add(
                "today"
            );
        }


        button.onclick = function(){

            selectDate(
                y,
                m,
                d
            );

        };


        container.appendChild(
            button
        );
    }
}


/* =========================================================
   باز کردن تقویم
========================================================= */

function openCalendar(){

    if(!calendar){

        const today =
            getTodayJalali();

        calendar = {
            y:today.y,
            m:today.m
        };
    }

    renderCalendar();

    $("calendarModal")
        .classList
        .add("show");
}


$("dateBtn").onclick =
    openCalendar;


/* =========================================================
   بستن
========================================================= */

$("closeCal").onclick =
    function(){

        $("calendarModal")
            .classList
            .remove("show");
    };


/* =========================================================
   ماه قبل
========================================================= */

$("prevMonth").onclick =
    function(){

        calendar.m--;

        if(calendar.m < 1){

            calendar.m = 12;

            calendar.y--;
        }

        renderCalendar();
    };


/* =========================================================
   ماه بعد
========================================================= */

$("nextMonth").onclick =
    function(){

        calendar.m++;

        if(calendar.m > 12){

            calendar.m = 1;

            calendar.y++;
        }

        renderCalendar();
    };


/* =========================================================
   امروز
========================================================= */

$("todayBtn").onclick =
    function(){

        const today =
            getTodayJalali();

        calendar = {
            y:today.y,
            m:today.m
        };

        selectDate(
            today.y,
            today.m,
            today.d
        );
    };


/* =========================================================
   محاسبه ساعت
========================================================= */

function duration(start,end){

    const a =
        start
        .split(":")
        .map(Number);

    const b =
        end
        .split(":")
        .map(Number);


    let startMinutes =
        a[0] * 60 +
        a[1];

    let endMinutes =
        b[0] * 60 +
        b[1];


    if(endMinutes < startMinutes){

        endMinutes += 1440;
    }


    return endMinutes -
        startMinutes;
}


/* =========================================================
   نمایش مدت
========================================================= */

function formatDuration(minutes){

    return `
        ${fa(
            Math.floor(
                minutes / 60
            )
        )}
        ساعت و
        ${fa(
            minutes % 60
        )}
        دقیقه
    `;
}


/* =========================================================
   ذخیره
========================================================= */

function save(){

    localStorage.setItem(
        "mahi_work",
        JSON.stringify(records)
    );
}


/* =========================================================
   حذف
========================================================= */

function removeRecord(index){

    records.splice(
        index,
        1
    );

    if(editIndex === index){

        editIndex = -1;

        $("addBtn").textContent =
            "＋ ثبت ساعت کاری";

        $("start").value = "";

        $("end").value = "";
    }
    else if(editIndex > index){

        editIndex--;
    }

    save();

    render();
}


/* =========================================================
   ویرایش ثبت
========================================================= */

function editRecord(index){

    const r = records[index];

    if(!r){
        return;
    }

    editIndex = index;

    const parts =
        r.date.split("/");

    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);

    selected = [
        y,
        m,
        d
    ];

    $("dateBtn").textContent =
        `${fa(y)}/${fa(
            String(m).padStart(2,"0")
        )}/${fa(
            String(d).padStart(2,"0")
        )}`;

    $("dayDisplay").textContent =
        getWeekday(y,m,d);

    $("start").value = r.start;

    $("end").value = r.end;

    $("addBtn").textContent =
        "✓ ذخیره ویرایش";

    window.scrollTo({
        top:0,
        behavior:"smooth"
    });
}


/* =========================================================
   نمایش اطلاعات
========================================================= */

function render(){

    const rows =
        $("rows");

    rows.innerHTML = "";


    const total =
        records.reduce(
            (sum,r) =>
                sum + r.min,
            0
        );


    const workDays =
        new Set(
            records.map(
                r => r.date
            )
        ).size;


    $("monthHours")
        .textContent =
        fa(
            (total / 60)
            .toFixed(1)
        );


    $("workDays")
        .textContent =
        fa(workDays);


    $("avgHours")
        .textContent =
        fa(
            workDays
            ?
            (total / 60 / workDays)
            .toFixed(1)
            :
            "0"
        );


    const today =
        getTodayJalali();


    const todayString =
        `${today.y}/${String(
            today.m
        ).padStart(2,"0")}/${String(
            today.d
        ).padStart(2,"0")}`;


    const todayMinutes =
        records
        .filter(
            r =>
                r.date ===
                todayString
        )
        .reduce(
            (sum,r) =>
                sum + r.min,
            0
        );


    $("todayHours")
        .textContent =
        fa(
            (todayMinutes / 60)
            .toFixed(1)
        );


    $("empty").style.display =
        records.length
        ?
        "none"
        :
        "block";


    records.forEach(
        (r,index) => {

            const tr =
                document.createElement(
                    "tr"
                );


            tr.innerHTML = `
                <td>${r.date}</td>
                <td>${r.day}</td>
                <td>${r.start}</td>
                <td>${r.end}</td>
                <td>${formatDuration(r.min)}</td>
                <td>
                    <button
                        class="edit"
                        onclick="editRecord(${index})"
                    >
                        ویرایش
                    </button>

                    <button
                        class="delete"
                        onclick="removeRecord(${index})"
                    >
                        حذف
                    </button>
                </td>
            `;


            rows.appendChild(tr);
        }
    );


    drawCharts(total);
}


/* =========================================================
   ثبت ساعت کاری
========================================================= */

$("addBtn").onclick =
    function(){

        if(!selected){

            alert(
                "ابتدا تاریخ را انتخاب کنید."
            );

            return;
        }


        const start =
            $("start").value;

        const end =
            $("end").value;


        if(!start || !end){

            alert(
                "ساعت ورود و خروج را کامل وارد کنید."
            );

            return;
        }


        if(start === end){

            alert(
                "ساعت ورود و خروج نمی‌تواند یکسان باشد."
            );

            return;
        }


        const y = selected[0];

        const m = selected[1];

        const d = selected[2];


        const dateString =
            `${y}/${String(m).padStart(
                2,"0"
            )}/${String(d).padStart(
                2,"0"
            )}`;


        const updatedRecord = {

            date:dateString,

            day:getWeekday(
                y,
                m,
                d
            ),

            start:start,

            end:end,

            min:duration(
                start,
                end
            )
        };


        if(editIndex !== -1){

            records[editIndex] =
                updatedRecord;

            editIndex = -1;

            $("addBtn").textContent =
                "＋ ثبت ساعت کاری";

        }
        else{

            records.push(
                updatedRecord
            );
        }


        save();

        render();


        $("start").value = "";

        $("end").value = "";
    };


/* =========================================================
   پاک کردن همه
========================================================= */

$("clearBtn").onclick =
    function(){

        if(
            confirm(
                "همه ثبت‌ها پاک شوند؟"
            )
        ){

            records = [];

            save();

            render();
        }
    };


/* =========================================================
   PDF
========================================================= */

$("pdfBtn").onclick =
    function(){

        if(!records.length){

            alert(
                "هنوز گزارشی برای ذخیره وجود ندارد."
            );

            return;
        }


        const total =
            records.reduce(
                (sum,r) =>
                    sum + r.min,
                0
            );


        const days =
            new Set(
                records.map(
                    r => r.date
                )
            ).size;


        const html = `

<!doctype html>

<html lang="fa" dir="rtl">

<head>

<meta charset="utf-8">

<title>
گزارش ساعت کاری ماهی
</title>

<style>

body{
    font-family:
    Tahoma,
    Arial,
    sans-serif;

    padding:35px;

    color:#222;
}

h1{
    text-align:center;

    color:#d6339c;
}

p{
    text-align:center;

    color:#666;
}

.summary{
    display:flex;

    gap:20px;

    justify-content:center;

    margin:20px 0;
}

.box{
    padding:12px 20px;

    background:#f7edf5;

    border-radius:12px;
}

table{
    width:100%;

    border-collapse:
    collapse;

    margin-top:25px;
}

th,
td{
    border:1px solid #ddd;

    padding:10px;

    text-align:center;
}

th{
    background:#f9d9ed;
}

</style>

</head>

<body>

<h1>
ساعت کاری ماهی
</h1>

<p>
گزارش ساعت کاری
</p>


<div class="summary">

<div class="box">
جمع کل:
${formatDuration(total)}
</div>

<div class="box">
روز کاری:
${fa(days)}
روز
</div>

</div>


<table>

<thead>

<tr>

<th>تاریخ</th>

<th>روز</th>

<th>ورود</th>

<th>خروج</th>

<th>مدت کار</th>

</tr>

</thead>


<tbody>

${records.map(
r => `

<tr>

<td>${r.date}</td>

<td>${r.day}</td>

<td>${r.start}</td>

<td>${r.end}</td>

<td>
${formatDuration(r.min)}
</td>

</tr>

`
).join("")}

</tbody>


<tfoot>

<tr>

<td colspan="4">
جمع کل
</td>

<td>
${formatDuration(total)}
</td>

</tr>

</tfoot>

</table>


<script>

window.onload =
function(){

    setTimeout(
        () => window.print(),
        400
    );

};

<\/script>

</body>

</html>
`;


        const popup =
            window.open(
                "",
                "_blank"
            );


        popup.document.write(
            html
        );

        popup.document.close();
    };


/* =========================================================
   نمودارها
========================================================= */

function drawCharts(total){

    const canvas =
        $("barChart");

    const ctx =
        canvas.getContext("2d");


    const width =
        canvas.clientWidth;

    const height =
        245;

    const dpr =
        window.devicePixelRatio || 1;


    canvas.width =
        width * dpr;

    canvas.height =
        height * dpr;


    ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );


    ctx.clearRect(
        0,
        0,
        width,
        height
    );


    const groups = {};


    records.forEach(
        r => {

            groups[r.date] =
                (
                    groups[r.date] || 0
                )
                +
                r.min / 60;
        }
    );


    const data =
        Object.entries(
            groups
        ).slice(-12);


    const max =
        Math.max(
            8,
            ...data.map(
                x => x[1]
            )
        );


    const step =
        (
            width - 45
        )
        /
        Math.max(
            data.length,
            1
        );


    const barWidth =
        Math.max(
            12,
            step - 10
        );


    ctx.font =
        "11px Tahoma";

    ctx.textAlign =
        "center";


    data.forEach(
        ([date,value],i) => {

            const x =
                35 +
                i * step +
                5;


            const y =
                height -
                35 -
                (
                    value /
                    max
                ) *
                (
                    height - 65
                );


            ctx.fillStyle =
                "#ff55bd";

            ctx.shadowBlur =
                15;

            ctx.shadowColor =
                "#ff55bd";


            ctx.fillRect(
                x,
                y,
                barWidth,
                height - 35 - y
            );


            ctx.shadowBlur =
                0;


            ctx.fillStyle =
                "#cdbdca";


            ctx.fillText(
                date.slice(-5),
                x + barWidth / 2,
                height - 16
            );


            ctx.fillStyle =
                "#fff";


            ctx.fillText(
                value.toFixed(1),
                x + barWidth / 2,
                y - 7
            );
        }
    );


    /* DONUT */

    const donut =
        $("donutChart");

    const dc =
        donut.getContext(
            "2d"
        );


    const dw =
        donut.clientWidth;

    const dh =
        245;


    donut.width =
        dw * dpr;

    donut.height =
        dh * dpr;


    dc.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );


    const cx =
        dw / 2;

    const cy =
        122;

    const radius =
        82;


    const percent =
        Math.min(
            total / 60 / 176,
            1
        );


    dc.lineWidth =
        22;

    dc.lineCap =
        "round";


    dc.beginPath();

    dc.strokeStyle =
        "#403645";

    dc.arc(
        cx,
        cy,
        radius,
        0,
        Math.PI * 2
    );

    dc.stroke();


    dc.beginPath();

    dc.strokeStyle =
        "#ff55bd";

    dc.shadowBlur =
        18;

    dc.shadowColor =
        "#ff55bd";


    dc.arc(
        cx,
        cy,
        radius,
        -Math.PI / 2,
        -Math.PI / 2 +
        Math.PI * 2 * percent
    );

    dc.stroke();


    dc.shadowBlur =
        0;


    $("donutText")
        .textContent =
        fa(
            Math.round(
                percent * 100
            )
        )
        + "٪";
}


/* =========================================================
   شروع سایت
========================================================= */

const today =
    getTodayJalali();


selectDate(
    today.y,
    today.m,
    today.d
);


render();


window.addEventListener(
    "resize",
    render
);
