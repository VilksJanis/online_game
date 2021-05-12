unset_identity();

async function join_game() {
    await register();
    let playername = $("#playerName").val();
    let theme = $("#teamSelect .carousel-item.active").id;
    localStorage.setItem('playerName', playername);

    fetch('/game/find',
        {
            method: 'post',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uid: localStorage.getItem("UID"),
            })
        }
    )
        .then(response => response.text())
        .then(data => {
            if (data != undefined && data != null && data != "false") {
                fetch('/game/instances/' + data,
                    {
                        method: 'post',
                        headers: {
                            'Accept': 'application/json, text/plain, */*',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            uid: localStorage.getItem("UID"),
                            playername: playername
                        })
                    })
                    .then(response => response.text())
                    .then(data => {
                        if (data != "false") {
                            window.location.href = data;
                        }
                    })

            }
        });

};


$(document).ready(function () {
    let player_name = localStorage.getItem('playerName');

    if (player_name != undefined && player_name != null) {
        $("#playerName").val(player_name);
    };


});