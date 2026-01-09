const form = document.getElementById("entry-form");
const entriesContainer = document.getElementById("entries");
const balanceEl = document.getElementById("balance");
const incomeEl = document.getElementById("total-income");
const expenseEl = document.getElementById("total-expense");
const clearAllButton = document.getElementById("clear-all");
const entryTemplate = document.getElementById("entry-template");

const storageKey = "family-budget-entries";

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

const updateUI = () => {
  const entries = loadEntries();
  renderSummary(entries);
  renderEntries(entries);
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

clearAllButton.addEventListener("click", () => {
  saveEntries([]);
  updateUI();
});

updateUI();
