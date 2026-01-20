const form = document.getElementById("entry-form");
const entriesContainer = document.getElementById("entries");
const balanceEl = document.getElementById("balance");
const incomeEl = document.getElementById("total-income");
const expenseEl = document.getElementById("total-expense");
const clearAllButton = document.getElementById("clear-all");
const deleteByPeriodButton = document.getElementById("delete-by-period");
const entryTemplate = document.getElementById("entry-template");
const importFileInput = document.getElementById("import-file");
const importButton = document.getElementById("import-button");
const importStatus = document.getElementById("import-status");
const confirmModal = document.getElementById("confirm-modal");
const confirmMessage = document.getElementById("confirm-message");
const confirmAccept = document.getElementById("confirm-accept");
const confirmCancel = document.getElementById("confirm-cancel");
const periodModal = document.getElementById("period-modal");
const periodMonthSelect = document.getElementById("period-month");
const periodYearSelect = document.getElementById("period-year");
const periodConfirm = document.getElementById("period-confirm");
const periodCancel = document.getElementById("period-cancel");

const storageKey = "family-budget-entries";
const monthNames = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

const formatCurrency = (value) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value);

const loadEntries = () => {
  const raw = localStorage.getItem(storageKey);
  return raw ? JSON.parse(raw) : [];
};

const saveEntries = (entries) => {
  localStorage.setItem(storageKey, JSON.stringify(entries));
};

const getEntryValueDate = (entry) => {
  const rawDate = entry.valueDate || entry.date;
  if (!rawDate) {
    return null;
  }
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

const openModal = (modal) => {
  if (!modal) {
    return;
  }
  modal.removeAttribute("hidden");
};

const closeModal = (modal) => {
  if (!modal) {
    return;
  }
  modal.setAttribute("hidden", "true");
};

let confirmAction = null;

const showConfirm = (message, onConfirm) => {
  if (!confirmModal || !confirmMessage) {
    if (window.confirm(message)) {
      onConfirm();
    }
    return;
  }
  confirmMessage.textContent = message;
  confirmAction = onConfirm;
  openModal(confirmModal);
};

const updateYearOptions = (entries) => {
  const years = [
    ...new Set(
      entries
        .map((entry) => getEntryValueDate(entry))
        .filter(Boolean)
        .map((date) => date.getFullYear())
    ),
  ];
  if (years.length === 0) {
    years.push(new Date().getFullYear());
  }
  years.sort((a, b) => b - a);
  const currentValue = periodYearSelect.value;
  periodYearSelect.innerHTML = "";
  years.forEach((year) => {
    const option = document.createElement("option");
    option.value = String(year);
    option.textContent = String(year);
    periodYearSelect.appendChild(option);
  });
  if (currentValue && years.includes(Number(currentValue))) {
    periodYearSelect.value = currentValue;
  }
};

const initMonthOptions = () => {
  if (periodMonthSelect.options.length > 0) {
    return;
  }
  monthNames.forEach((month, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = month;
    periodMonthSelect.appendChild(option);
  });
  periodMonthSelect.value = String(new Date().getMonth());
};

const renderSummary = (entries) => {
  const totals = entries.reduce(
    (acc, entry) => {
      if (entry.type === "income") {
        acc.income += entry.amount;
      } else {
        acc.expense += entry.amount;
      }
      return acc;
    },
    { income: 0, expense: 0 }
  );

  incomeEl.textContent = formatCurrency(totals.income);
  expenseEl.textContent = formatCurrency(totals.expense);
  balanceEl.textContent = formatCurrency(totals.income - totals.expense);
};

const renderEntries = (entries) => {
  entriesContainer.innerHTML = "";

  if (entries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Nessun movimento registrato. Inizia aggiungendone uno!";
    entriesContainer.appendChild(empty);
    return;
  }

  entries
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach((entry) => {
      const row = entryTemplate.content.cloneNode(true);
      const rowEl = row.querySelector(".table__row");
      rowEl.classList.add(
        entry.type === "income" ? "entry--income" : "entry--expense"
      );
      row.querySelector(".entry__description").textContent = entry.description;
      row.querySelector(".entry__date").textContent = new Date(
        entry.date
      ).toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      row.querySelector(".entry__type").textContent =
        entry.type === "income" ? "Entrata" : "Uscita";
      row.querySelector(".entry__amount").textContent = formatCurrency(
        entry.amount
      );
      row.querySelector("button").addEventListener("click", () => {
        const updated = loadEntries().filter((item) => item.id !== entry.id);
        saveEntries(updated);
        updateUI();
      });
      entriesContainer.appendChild(row);
    });
};

const setImportStatus = (message, type = "info") => {
  if (!importStatus) {
    return;
  }
  importStatus.textContent = message;
  importStatus.dataset.status = type;
};

const normalizeHeader = (value) =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const parseExcelDate = (value) => {
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) {
      return null;
    }
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
};

const parseAmount = (value) => {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.replace(/\./g, "").replace(",", ".");
    const parsed = Number.parseFloat(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const importEntries = (rows) => {
  if (rows.length === 0) {
    return { imported: 0, errors: ["Il file non contiene righe."] };
  }

  const headers = rows[0].map((header) => normalizeHeader(header || ""));
  const requiredHeaders = {
    "data contabile": null,
    "data valuta": null,
    importo: null,
    descrizione: null,
  };

  headers.forEach((header, index) => {
    if (header in requiredHeaders) {
      requiredHeaders[header] = index;
    }
  });

  const missing = Object.entries(requiredHeaders)
    .filter(([, index]) => index === null)
    .map(([header]) => header);

  if (missing.length > 0) {
    return {
      imported: 0,
      errors: [
        `Colonne mancanti: ${missing.join(", ")}.`,
      ],
    };
  }

  const entries = loadEntries();
  let imported = 0;
  const errors = [];

  rows.slice(1).forEach((row, rowIndex) => {
    if (row.length === 0 || row.every((cell) => cell === undefined || cell === "")) {
      return;
    }

    const accountingDate = parseExcelDate(
      row[requiredHeaders["data contabile"]]
    );
    const valueDate = parseExcelDate(row[requiredHeaders["data valuta"]]);
    const amountValue = parseAmount(row[requiredHeaders.importo]);
    const description = String(
      row[requiredHeaders.descrizione] ?? ""
    ).trim();

    if (!accountingDate || amountValue === null || !description) {
      errors.push(`Riga ${rowIndex + 2}: dati non validi.`);
      return;
    }

    const type = amountValue >= 0 ? "income" : "expense";
    const amount = Math.abs(amountValue);

    entries.push({
      id: crypto.randomUUID(),
      description,
      amount,
      type,
      date: accountingDate.toISOString(),
      valueDate: valueDate ? valueDate.toISOString() : null,
    });
    imported += 1;
  });

  saveEntries(entries);
  updateUI();

  return { imported, errors };
};

const updateUI = () => {
  const entries = loadEntries();
  renderSummary(entries);
  renderEntries(entries);
  updateYearOptions(entries);
};

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const description = document.getElementById("description").value.trim();
  const amount = Number.parseFloat(
    document.getElementById("amount").value
  );
  const type = document.getElementById("type").value;

  if (!description || Number.isNaN(amount) || amount <= 0) {
    return;
  }

  const entries = loadEntries();
  entries.push({
    id: crypto.randomUUID(),
    description,
    amount,
    type,
    date: new Date().toISOString(),
  });
  saveEntries(entries);
  form.reset();
  updateUI();
});

if (clearAllButton) {
  clearAllButton.addEventListener("click", () => {
    showConfirm(
      "Attenzione! Stai per cancellare tutto l'archivio dei movimenti. Vuoi continuare?",
      () => {
        saveEntries([]);
        updateUI();
      }
    );
  });
}

if (deleteByPeriodButton) {
  deleteByPeriodButton.addEventListener("click", () => {
    initMonthOptions();
    updateYearOptions(loadEntries());
    openModal(periodModal);
  });
}

if (periodCancel) {
  periodCancel.addEventListener("click", () => {
    closeModal(periodModal);
  });
}

if (periodConfirm) {
  periodConfirm.addEventListener("click", () => {
    const monthIndex = Number(periodMonthSelect.value);
    const year = Number(periodYearSelect.value);
    const monthLabel = monthNames[monthIndex];
    closeModal(periodModal);
    showConfirm(
      `Attenzione!! Stai per cancellare i movimenti relativi al mese di ${monthLabel} ${year}. Vuoi continuare?`,
      () => {
        const entries = loadEntries();
        const updated = entries.filter((entry) => {
          const date = getEntryValueDate(entry);
          if (!date) {
            return true;
          }
          return !(date.getMonth() === monthIndex && date.getFullYear() === year);
        });
        saveEntries(updated);
        updateUI();
      }
    );
  });
}

if (confirmCancel) {
  confirmCancel.addEventListener("click", () => {
    closeModal(confirmModal);
    confirmAction = null;
  });
}

if (confirmAccept) {
  confirmAccept.addEventListener("click", () => {
    if (confirmAction) {
      confirmAction();
    }
    confirmAction = null;
    closeModal(confirmModal);
  });
}

importButton.addEventListener("click", () => {
  if (typeof XLSX === "undefined") {
    setImportStatus(
      "Libreria di importazione non disponibile. Ricarica la pagina o controlla la connessione.",
      "error"
    );
    return;
  }

  if (!importFileInput.files || importFileInput.files.length === 0) {
    setImportStatus("Seleziona un file Excel da importare.", "error");
    return;
  }

  const [file] = importFileInput.files;
  const reader = new FileReader();
  setImportStatus("Importazione in corso...", "info");

  reader.onload = (event) => {
    try {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
      });

      const { imported, errors } = importEntries(rows);

      if (errors.length > 0 && imported === 0) {
        setImportStatus(errors.join(" "), "error");
        return;
      }

      if (errors.length > 0) {
        setImportStatus(
          `Importati ${imported} movimenti. ${errors.join(" ")}`,
          "error"
        );
      } else {
        setImportStatus(
          imported > 0
            ? `Importati ${imported} movimenti con successo.`
            : "Nessun movimento importato.",
          "success"
        );
      }
      importFileInput.value = "";
    } catch (error) {
      setImportStatus(
        "Errore durante la lettura del file. Verifica il formato del tracciato.",
        "error"
      );
    }
  };

  reader.onerror = () => {
    setImportStatus("Impossibile leggere il file selezionato.", "error");
  };

  reader.readAsArrayBuffer(file);
});

importFileInput.addEventListener("change", () => {
  setImportStatus("", "info");
});

updateUI();
initMonthOptions();
