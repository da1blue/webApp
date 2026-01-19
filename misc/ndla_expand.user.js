// ==UserScript==
// @name         WebNDLA Expander
// @namespace    https://da1.blue/ndla_expander
// @version      0.0.1
// @description  Expand WebNDLA
// @author       da1.blue
// @match        https://id.ndl.go.jp/auth/ndlna/*
// @match        https://id.ndl.go.jp/auth/ndlsh/*
// @grant        none
// ==/UserScript==

(async function () {
    'use strict';

    //JSON取得
    async function getJson(url) {
        console.log("requesting " + url);
        return await (await fetch(url)).json();
    }

    //関数：　SPARQLクエリ作成
    function makeSpqReqUrl(endpoint, query) {
        let url = endpoint;
        url += "?format=json&query="
        url += encodeURIComponent(query);
        return url;
    }

    //CDNからFontAwesome読み込み
    let awesomeScript = document.createElement("script");
    awesomeScript.setAttribute("src", "https://kit.fontawesome.com/56e7d4fdc1.js");
    awesomeScript.setAttribute("crossorigin", "anonymous")
    document.getElementsByTagName("head")[0].appendChild(awesomeScript);

    //追加記述領域を作成（非表示）
    let divAside = document.getElementById("relmenu");
    let addedSection = document.createElement("div");
    addedSection.setAttribute("style", "border-style: none; border-width: 2px; border-top-style: dashed; border-color: gray; display:none")
    divAside.appendChild(addedSection);
    let addedSectionStyle = document.createElement("style");
    addedSectionStyle.innerText = `div#relmenu ul.exLink {padding-left: 1.5em;}
        div#relmenu ul.exLink li{margin:0;}
        div#relmenu ul.exLink li a {border-style : none; background : none; padding: 0.2em 0.4em; text-decoration: underline dotted gray; text-align: left; width:auto;}
        div#relmenu ul.exLink span.fa-li{left:0em}
        div#relmenu h3{font-size:100%}`
    addedSection.appendChild(addedSectionStyle);
    let h2LOD = document.createElement("h2");
    h2LOD.setAttribute("style", "font-size: 100%; margin-bottom:0")
    h2LOD.innerText = "Enhanced by LOD";
    addedSection.appendChild(h2LOD);
    let ulExLink = document.createElement("ul");
    ulExLink.setAttribute("class", "exLink")
    ulExLink.setAttribute("style", "margin:0")
    addedSection.appendChild(ulExLink);
    var dispFlag = 0;

    //ndlnaを取得
    const ndlna = (location.href).match(/\d+$/)[0];
    const ndlnaURI = "ndlna:" + ndlna;
    //Wikipediaへのリンクを作成
    let wd = "";
    let lang = ["ja", "en"];
    let wdQuerys = [];
    for (let i in lang) {
        let wdQuery = `SELECT ?wd ?wkpUrl ?name WHERE {
?wkpUrl schema:about ?wd ;
schema:name ?name;
schema:isPartOf <https://` + lang[i] + `.wikipedia.org/> .
?wd wdt:P349 "` + ndlna + `". }`;
        wdQuerys.push(wdQuery);
    }

    for (let i in wdQuerys) {
        let wdReq = makeSpqReqUrl("https://query.wikidata.org/sparql", wdQuerys[i]);
        let wdRes = await getJson(wdReq);
        if (wdRes.results.bindings.length) {
            let wkpUrl = wdRes.results.bindings[0].wkpUrl.value;
            let wkpName = wdRes.results.bindings[0].name.value;
            let wkpLink = document.createElement("li");
            wkpLink.innerHTML = "<span class='fa-li'><i class='fab fa-wikipedia-w'></i></span><a href='" + wkpUrl + "'>" + wkpName + "<small>(" + lang[i] + ")</small></a>";
            ulExLink.appendChild(wkpLink);
            dispFlag++
        }
    }
    if (dispFlag) {
        addedSection.style.display = "block";
    }
})();
