async function fetchWithTimeout(resource, options) {
  const { timeout = 1000 } = options;
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  const response = await fetch(resource, {
    ...options,
    signal: controller.signal  
  });
  clearTimeout(id);

  return response;
}

function int2ip (ipInt) {
    return ( (ipInt>>>24) +'.' + (ipInt>>16 & 255) +'.' + (ipInt>>8 & 255) +'.' + (ipInt & 255) );
}

function randomIP() {
	return int2ip(Math.random()*4294967296) ;
}

async function tryIP(ip) {
	const r = await fetchWithTimeout("http://"+ip, {mode:"no-cors"}).catch(e => {
    return e;
  });
	return [r,ip];
}

async function findIP() {
	const isOk = (response) => typeof(response[0].ok) == "undefined";

	do {
		var r = await Promise.all( new Array(10).fill().map(randomIP).map(tryIP) );
	} while ( r.every(isOk) )

	for ( var i = 0 ; i < r.length ; i++ ) {
		if( r[i][0].toString() == "[object Response]") {
			return r[i][1];
		}
	}

}

function goToIp() {
	var w = findIP() ;
	document.getElementById("spinner").style.display = "block";
	document.getElementById("server_link").style.display = "none";
	document.getElementById("server_iframe").style.display = "none";
	w.then( (ip) => {
		document.getElementById("spinner").style.display = "none";
		document.getElementById("server_link").href = "http://"+ip;
		document.getElementById("server_link").innerText = "http://"+ip;
		document.getElementById("server_iframe").src = "http://"+ip;
		document.getElementById("server_iframe").style.display = "block";
		document.getElementById("server_link").style.display = "block";
	});
	document.getElementById("server_card").classList.remove("view_site")
}