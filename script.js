// Application State
let users = [];
let payments = [];
let balances = {};

// User Management Functions
function addUser() {
    const userNameInput = document.getElementById('userName');
    const userName = userNameInput.value.trim();

    if (!userName) {
        alert('Please enter a user name');
        return;
    }

    if (users.includes(userName)) {
        alert('User already exists');
        return;
    }

    users.push(userName);
    userNameInput.value = '';
    updateUserList();
    updatePayerSelect();
    updateSpecificUsersCheckboxes();
}

function removeUser(userName) {
    const index = users.indexOf(userName);
    if (index > -1) {
        users.splice(index, 1);
        // Remove user from existing payments
        payments = payments.filter(payment =>
            payment.payer !== userName &&
            !payment.splitAmong.includes(userName)
        );
        updateUserList();
        updatePayerSelect();
        updateSpecificUsersCheckboxes();
        updatePaymentList();
    }
}

function updateUserList() {
    const userList = document.getElementById('userList');
    userList.innerHTML = '';

    if (users.length === 0) {
        userList.innerHTML = '<div class="empty-state">No users added yet. Add some users to get started!</div>';
        return;
    }

    users.forEach(user => {
        const li = document.createElement('li');
        li.className = 'user-item';
        li.innerHTML = `
                    <span>👤 ${user}</span>
                    <button class="remove-btn" onclick="removeUser('${user}')">Remove</button>
                `;
        userList.appendChild(li);
    });
}

function updatePayerSelect() {
    const payerSelect = document.getElementById('payerSelect');
    payerSelect.innerHTML = '<option value="">Select payer</option>';

    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user;
        option.textContent = user;
        payerSelect.appendChild(option);
    });
}

function updateSpecificUsersCheckboxes() {
    const specificUsersDiv = document.getElementById('specificUsers');
    specificUsersDiv.innerHTML = '';

    users.forEach(user => {
        const checkboxLabel = document.createElement('label');
        checkboxLabel.className = 'checkbox-item';
        checkboxLabel.innerHTML = `
            <input type="checkbox" id="user_${user}" value="${user}">
            <span>${user}</span>
        `;
        specificUsersDiv.appendChild(checkboxLabel);
    });
}

// Payment Management Functions
function addPayment() {
    const payer = document.getElementById('payerSelect').value;
    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const description = document.getElementById('paymentDescription').value.trim();
    const splitType = document.querySelector('input[name="splitType"]:checked').value;

    if (!payer) {
        alert('Please select who paid');
        return;
    }

    if (!amount || amount <= 0) {
        alert('Please enter a valid amount');
        return;
    }

    if (!description) {
        alert('Please enter a description');
        return;
    }

    let splitAmong = [];

    if (splitType === 'all') {
        splitAmong = [...users];
    } else {
        const checkedUsers = document.querySelectorAll('#specificUsers input[type="checkbox"]:checked');
        splitAmong = Array.from(checkedUsers).map(cb => cb.value);

        if (splitAmong.length === 0) {
            alert('Please select at least one user to split among');
            return;
        }
    }

    const payment = {
        id: Date.now(),
        payer,
        amount,
        description,
        splitAmong: [...splitAmong],
        timestamp: new Date().toLocaleString()
    };

    payments.push(payment);

    // Clear form
    document.getElementById('paymentAmount').value = '';
    document.getElementById('paymentDescription').value = '';
    document.getElementById('splitAll').checked = true;
    document.getElementById('splitSpecific').checked = false;
    document.getElementById('specificUsers').style.display = 'none';
    document.querySelectorAll('#specificUsers input[type="checkbox"]').forEach(cb => cb.checked = false);

    updatePaymentList();
}

function removePayment(paymentId) {
    payments = payments.filter(payment => payment.id !== paymentId);
    updatePaymentList();
}

function updatePaymentList() {
    const paymentList = document.getElementById('paymentList');
    paymentList.innerHTML = '';

    if (payments.length === 0) {
        paymentList.innerHTML = '<div class="empty-state">No payments recorded yet.</div>';
        return;
    }

    payments.forEach(payment => {
        const li = document.createElement('li');
        li.className = 'payment-item';
        li.innerHTML = `
                    <div>
                        <strong>${payment.description}</strong>
                        <div class="payment-details">
                            💰 $${payment.amount.toFixed(2)} paid by ${payment.payer}
                            <br>👥 Split among: ${payment.splitAmong.join(', ')}
                            <br>🕒 ${payment.timestamp}
                        </div>
                    </div>
                    <button class="remove-btn" onclick="removePayment(${payment.id})">Remove</button>
                `;
        paymentList.appendChild(li);
    });
}

// Balance Calculation Functions
function calculateBalances() {
    if (users.length === 0) {
        alert('Please add users first');
        return;
    }

    if (payments.length === 0) {
        alert('Please record some payments first');
        return;
    }

    // Initialize balances for all users
    balances = {};
    users.forEach(user => {
        balances[user] = 0;
    });

    // Calculate net balances
    payments.forEach(payment => {
        const splitAmount = payment.amount / payment.splitAmong.length;

        // Add amount paid to payer's balance
        balances[payment.payer] += payment.amount;

        // Subtract each person's share from their balance
        payment.splitAmong.forEach(user => {
            balances[user] -= splitAmount;
        });
    });

    // Calculate optimal settlements using debt simplification algorithm
    const settlements = calculateOptimalSettlements(balances);

    displayBalanceResults(balances, settlements);
}

function calculateOptimalSettlements(balances) {
    // Create arrays of creditors (positive balance) and debtors (negative balance)
    const creditors = [];
    const debtors = [];

    Object.entries(balances).forEach(([user, balance]) => {
        if (balance > 0.01) { // Small threshold to handle floating point precision
            creditors.push({ user, amount: balance });
        } else if (balance < -0.01) {
            debtors.push({ user, amount: Math.abs(balance) });
        }
    });

    // Sort by amount for optimal matching
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    const settlements = [];
    let i = 0, j = 0;

    // Match creditors with debtors
    while (i < creditors.length && j < debtors.length) {
        const creditor = creditors[i];
        const debtor = debtors[j];

        const settleAmount = Math.min(creditor.amount, debtor.amount);

        if (settleAmount > 0.01) {
            settlements.push({
                from: debtor.user,
                to: creditor.user,
                amount: settleAmount
            });
        }

        creditor.amount -= settleAmount;
        debtor.amount -= settleAmount;

        if (creditor.amount < 0.01) i++;
        if (debtor.amount < 0.01) j++;
    }

    return settlements;
}

function displayBalanceResults(balances, settlements) {
    const balanceResults = document.getElementById('balanceResults');
    balanceResults.innerHTML = '';

    // Individual Balances Card
    const balanceCard = document.createElement('div');
    balanceCard.className = 'balance-card';
    balanceCard.innerHTML = '<h3>💳 Individual Balances</h3>';

    Object.entries(balances).forEach(([user, balance]) => {
        const balanceItem = document.createElement('div');
        balanceItem.className = 'debt-item';

        const balanceClass = balance > 0 ? 'amount-positive' : 'amount-negative';
        const balanceText = balance > 0 ?
            `Should receive $${balance.toFixed(2)}` :
            `Owes $${Math.abs(balance).toFixed(2)}`;

        balanceItem.innerHTML = `
                    <span>👤 ${user}</span>
                    <span class="${balanceClass}">${balanceText}</span>
                `;
        balanceCard.appendChild(balanceItem);
    });

    balanceResults.appendChild(balanceCard);

    // Settlements Card
    const settlementsCard = document.createElement('div');
    settlementsCard.className = 'balance-card';
    settlementsCard.innerHTML = '<h3>🔄 Recommended Settlements</h3>';

    if (settlements.length === 0) {
        settlementsCard.innerHTML += '<div class="debt-item">✅ All balances are settled!</div>';
    } else {
        settlements.forEach(settlement => {
            const settlementItem = document.createElement('div');
            settlementItem.className = 'debt-item';
            settlementItem.innerHTML = `
                        <span>💸 ${settlement.from} → ${settlement.to}</span>
                        <span class="amount-negative">$${settlement.amount.toFixed(2)}</span>
                    `;
            settlementsCard.appendChild(settlementItem);
        });
    }

    balanceResults.appendChild(settlementsCard);
}

// Theme Management
function initTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const icon = themeToggle.querySelector('.material-icons');

    // Check for saved theme preference, otherwise use system preference
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
        document.body.classList.add('dark');
        icon.textContent = 'light_mode';
    }

    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark');
        const isDark = document.body.classList.contains('dark');

        // Update icon
        icon.textContent = isDark ? 'light_mode' : 'dark_mode';

        // Save preference
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function () {
    initTheme();

    // Handle split type radio button changes
    document.querySelectorAll('input[name="splitType"]').forEach(radio => {
        radio.addEventListener('change', function () {
            const specificUsersDiv = document.getElementById('specificUsers');
            if (this.value === 'specific') {
                specificUsersDiv.style.display = 'grid';
            } else {
                specificUsersDiv.style.display = 'none';
            }
        });
    });

    // Handle Enter key in user name input
    document.getElementById('userName').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            addUser();
        }
    });
});
