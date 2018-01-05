import api from "/ts.js";

window.addEventListener("load", evt => {
    let link = document.querySelector('link[rel="import"]');
    let importDoc = link.import;

    let style = importDoc.querySelector('link[rel="stylesheet"]');
    document.head.appendChild(style);

    let el = importDoc.querySelector("div");
    document.body.appendChild(el.cloneNode(true));

    api.init();
});
