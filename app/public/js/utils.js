let UID = null;
let SEC = null;

function unset_identity() {
    localStorage.removeItem('UID');
    localStorage.removeItem('SEC');

    UID = null;
    SEC = null;
}

async function register() {
    if (UID == undefined && UID == null || SEC == undefined && SEC == null) {
        await fetch('/api/register')
        .then(response => response.json())
        .then(data => {
            localStorage.setItem('UID', data.uid);
            localStorage.setItem('SEC', data.secret);
            UID = data.uid;
            SEC = data.secret;
        });
    };
};


if (localStorage.getItem('UID') == null || localStorage.getItem('UID') == null) {
    register();
}

