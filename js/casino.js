async function fetchWithTimeout(resource, options) {
  // from here : https://dmitripavlutin.com/timeout-fetch-request/
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


isPrivate = function(ip) {
  // from https://gist.github.com/TheBigSadowski/5105254
  return /^10\.|^192\.168\.|^172\.16\.|^172\.17\.|^172\.18\.|^172\.19\.|^172\.20\.|^172\.21\.|^172\.22\.|^172\.23\.|^172\.24\.|^172\.25\.|^172\.26\.|^172\.27\.|^172\.28\.|^172\.29\.|^172\.30\.|^172\.31\./.test(ip);
  }

function randomIP() {
	var ip = int2ip(Math.random()*4294967296) ;
	if ( isPrivate(ip) ) return randomIP() ;
	return ip ;
}

async function tryIP(ip) {
	const port = document.getElementById("port").value;
	const r = await fetchWithTimeout("http://"+ip+":"+port, {mode:"no-cors"}).catch(e => {
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
