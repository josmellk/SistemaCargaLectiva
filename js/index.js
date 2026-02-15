let malla = [];
let notas = {};
let avgCiclo = {};

window.addEventListener('DOMContentLoaded', async () => {
    const doc = await db.collection("planificacion").doc("config_general").get();
    if (doc.exists) {
        const data = doc.data();
        malla = data.mallaParaDocentes || [];
        notas = data.notasProcesadas || {};
        avgCiclo = data.avgCicloProcesado || {};
        actualizarEstadoArchivo('Malla', malla.length > 0);
        actualizarEstadoArchivo('Notas', Object.keys(notas).length > 0);
        if (malla.length > 0) document.getElementById('btnEliminarMalla').style.display = 'block';

        const s = data.stats;
        if (s) {
            document.getElementById('tbodyServicios').innerHTML = s.serv;
            document.getElementById('tbodySistemas').innerHTML = s.sist;
            document.getElementById('tbodyDivisiones').innerHTML = s.divi;
            document.getElementById('statCursos').textContent = s.c1;
            document.getElementById('statDivisiones').textContent = s.c2;
            document.getElementById('statEstudiantes').textContent = s.c3;
            document.getElementById('statCriticos').textContent = s.c4;
            document.getElementById('countServicios').textContent = s.n1;
            document.getElementById('countSistemas').textContent = s.n2;
            document.getElementById('countDivisiones').textContent = s.n3;
            document.getElementById('resWrapper').style.display = "block";
            document.getElementById('statsGrid').style.display = "grid";
        }
    }
});

function actualizarEstadoArchivo(archivo, estado) {
    const el = document.getElementById(`status${archivo}`);
    el.textContent = estado ? "✓ Cargado" : "Pendiente";
    el.className = estado ? "file-status file-loaded" : "file-status file-pending";
    document.getElementById('btnProcesar').disabled = !(malla.length > 0 && Object.keys(notas).length > 0);
}

function leer(e, cb) {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = x => {
        const wb = XLSX.read(x.target.result, { type: 'binary' });
        cb(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]));
    };
    r.readAsBinaryString(file);
}

document.getElementById('mallaFile').addEventListener('change', e => {
    leer(e, d => {
        malla = d;
        actualizarEstadoArchivo('Malla', true);
    });
});

document.getElementById('notasFile').addEventListener('change', e => {
    leer(e, data => {
        notas = {}; let sums = {};
        data.forEach(r => {
            let codigo = clean(r["CÓD.ASIG."] || "");
            let ciclo = (r["CICLO"] || "").toString().trim();
            let colM = Object.keys(r).find(k => k.includes("TOTAL") && k.includes("MATRI"));
            if (codigo) {
                notas[codigo] = { a: parseInt(r["APROB."] || 0), d: parseInt(r["DESAPR."] || 0) };
                if (ciclo && r[colM]) { if (!sums[ciclo]) sums[ciclo] = []; sums[ciclo].push(parseInt(r[colM])); }
            }
        });
        for (let cic in sums) avgCiclo[cic] = Math.round(sums[cic].reduce((a, b) => a + b, 0) / sums[cic].length);
        actualizarEstadoArchivo('Notas', true);
    });
});

function procesar() {
    const nIng = parseInt(document.getElementById('ingresantes').value);
    const vPrac = parseInt(document.getElementById('divPrac').value);
    const vFull = parseInt(document.getElementById('divFull').value);
    const tbServ = document.getElementById('tbodyServicios');
    const tbSist = document.getElementById('tbodySistemas');
    const tbDivi = document.getElementById('tbodyDivisiones');
    tbServ.innerHTML = ""; tbSist.innerHTML = ""; tbDivi.innerHTML = "";

    let grupos = []; let electivos = {};
    let censoCursos = {};

    malla.forEach(c => {
        if ((c["TC"] || "").trim() === "E") {
            if (!electivos[c["CICLO"]]) electivos[c["CICLO"]] = [];
            electivos[c["CICLO"]].push(c);
        } else grupos.push({ tipo: "OBLIG", cursos: [c] });
    });
    for (let cic in electivos) grupos.push({ tipo: "ELECT", cursos: electivos[cic] });
    grupos.sort((a, b) => ROMANOS.indexOf(a.cursos[0]["CICLO"]) - ROMANOS.indexOf(b.cursos[0]["CICLO"]));

    let uCServ = "", uCSist = "";
    let totalCursos = grupos.length, conDivision = 0, totalEstudiantes = 0, cursosCriticos = 0;

    grupos.forEach(g => {
        let cP = g.cursos[0], cicA = cP["CICLO"];
        let base = 0, req = clean(cP["REQUE"] || "");
        if (notas[req]) base = notas[req].a;
        else if (ROMANOS.indexOf(cicA) === 1) base = nIng;
        else base = avgCiclo[ROMANOS[ROMANOS.indexOf(cicA) - 1]] || 0;

        let rep = g.cursos.reduce((acc, cur) => acc + (notas[clean(cur["CÓD.ASIG."] || "")] ? notas[clean(cur["CÓD.ASIG."] || "")].d : 0), 0);
        let total = base + rep; totalEstudiantes += total;
        let htSum = g.cursos.reduce((acc, c) => acc + (parseInt(c["HT"]) || 0), 0);
        let hpSum = g.cursos.reduce((acc, c) => acc + (parseInt(c["HP"]) || 0), 0);

        g.cursos.forEach(cur => {
            const cod = clean(cur["CÓD.ASIG."] || "");
            const repCurso = notas[cod] ? notas[cod].d : 0;
            censoCursos[cod] = {
                ciclo: cicA,
                curso: cur["CURSO"],
                ht: parseInt(cur["HT"]) || 0,
                hp: parseInt(cur["HP"]) || 0,
                th: (parseInt(cur["HT"]) || 0) + (parseInt(cur["HP"]) || 0),
                base: base,
                rep: repCurso,
                total: base + repCurso
            };
        });

        let pb = "", tieneDiv = false, esFull = false;
        if (hpSum > 0 || htSum > 0) {
            if (total > vFull) { pb = `<span class="sug-badge sug-full">DIV. COMPLETA</span>`; tieneDiv = true; esFull = true; conDivision++; }
            else if (total >= vPrac) { pb = `<span class="sug-badge sug-prac">DIV. PRÁCTICA</span>`; tieneDiv = true; conDivision++; }
            else { pb = `<span class="sug-badge sug-unico">GRUPO ÚNICO</span>`; if (total < 15) cursosCriticos++; }
        } else { pb = `<span class="sug-badge sug-unico">SOLO TEORÍA</span>`; if (total < 15) cursosCriticos++; }

        let esServ = LISTA_16_CURSOS.some(n => cleanNombre(cP["CURSO"] || "").includes(n));
        let eCls = (esServ ? (cicA !== uCServ ? "new-cycle-row" : "") : (cicA !== uCSist ? "new-cycle-row" : ""));
        if (esServ) uCServ = cicA; else uCSist = cicA;

        let row = `<tr class="ciclo-${cicA} ${eCls}"><td><strong>${cicA}</strong></td>${!esServ ? `<td>${g.tipo}</td>` : ''}<td>${g.cursos.map(c => c["CÓD.ASIG."]).join("<br>")}</td><td class="col-asig">${g.cursos.map(c => c["CURSO"]).join("<br>")}</td><td>${htSum}</td><td>${hpSum}</td><td>${htSum + hpSum}</td><td>${base}</td><td>${rep}</td><td class="total-val">${total}</td><td>${pb}</td></tr>`;
        if (esServ) tbServ.innerHTML += row; else tbSist.innerHTML += row;
        if (!esServ && tieneDiv) {
            tbDivi.innerHTML += `<tr class="ciclo-${cicA}"><td>${cicA}</td><td>${g.cursos.map(c => c["CÓD.ASIG."]).join("<br>")}</td><td class="col-asig">${g.cursos.map(c => c["CURSO"]).join("<br>")}</td><td style="font-weight:bold; color:var(--orange)">${esFull ? htSum : '-'}</td><td style="font-weight:bold; color:var(--purple)">${hpSum}</td><td class="total-val">${total}</td><td>${pb}</td></tr>`;
        }
    });

    const stats = {
        serv: tbServ.innerHTML, sist: tbSist.innerHTML, divi: tbDivi.innerHTML,
        c1: totalCursos, c2: conDivision, c3: totalEstudiantes, c4: cursosCriticos,
        n1: tbServ.children.length, n2: tbSist.children.length, n3: tbDivi.children.length
    };

    db.collection("planificacion").doc("config_general").set({
        mallaParaDocentes: malla,
        notasProcesadas: notas,
        avgCicloProcesado: avgCiclo,
        stats: stats,
        censoCursos: censoCursos,
        numIngresantes: nIng,
        ultimaActualizacion: new Date()
    }).then(() => alert("✅ Planificación y censo sincronizados."));

    document.getElementById('statCursos').textContent = totalCursos;
    document.getElementById('statDivisiones').textContent = conDivision;
    document.getElementById('statEstudiantes').textContent = totalEstudiantes;
    document.getElementById('statCriticos').textContent = cursosCriticos;
    document.getElementById('countServicios').textContent = stats.n1;
    document.getElementById('countSistemas').textContent = stats.n2;
    document.getElementById('countDivisiones').textContent = stats.n3;
    document.getElementById('resWrapper').style.display = "block";
    document.getElementById('statsGrid').style.display = "grid";
}

function limpiarTodo() { if (confirm("¿Borrar todo?")) { db.collection("planificacion").doc("config_general").delete(); localStorage.clear(); location.reload(); } }
function abrirCargaLectiva() { if (malla.length === 0) return alert("⚠️ Carga la malla primero."); window.open('carga_docente.html', '_blank'); }
function eliminarMallaGuardada() { db.collection("planificacion").doc("config_general").delete(); location.reload(); }
