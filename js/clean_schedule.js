
// --- LIMPIEZA DE HORARIOS AL ELIMINAR CURSOS/DOCENTES ---
async function cleanScheduleForDocente(docName, courseCode = null) {
    console.log(`Limpiando horarios para: ${docName}, curso: ${courseCode || "TODOS"}`);
    const horarioRef = db.collection("planificacion").doc("horarios");

    try {
        const docSnap = await horarioRef.get();
        if (!docSnap.exists) return;

        let horarios = docSnap.data().horariosGeneral || {};
        let changed = false;

        // Iterate over all cycles
        Object.keys(horarios).forEach(ciclo => {
            const cicloData = horarios[ciclo];
            Object.keys(cicloData).forEach(key => {
                const bloques = cicloData[key];
                // Filter out blocks that match
                const newBloques = bloques.filter(b => {
                    const isDocente = b.docente === docName;
                    if (!isDocente) return true; // Keep it

                    // If courseCode is provided, only remove if code matches
                    if (courseCode) {
                        return b.codigo.toString().trim() !== courseCode.toString().trim();
                    }

                    // If no courseCode, remove all for this docente
                    return false;
                });

                if (newBloques.length !== bloques.length) {
                    horarios[ciclo][key] = newBloques;
                    changed = true;
                }
            });
        });

        if (changed) {
            await horarioRef.update({
                horariosGeneral: horarios,
                ultimaActualizacion: new Date()
            });
            console.log("Horarios actualizados (limpieza exitosa).");
        }

    } catch (err) {
        console.error("Error cleaning schedule:", err);
        showToast("Error al sincronizar con horarios.", "error");
    }
}
