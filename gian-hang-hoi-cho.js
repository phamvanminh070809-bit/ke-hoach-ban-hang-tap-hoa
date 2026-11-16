const STORAGE_KEY = "fair_booth_economics_v1";

const BTC_SAMPLE = {
  isSample: true,
  products: [
    { id: "p1", name: "Trà chanh", price: 20000, varCost: 8000, plannedQty: 80, trialSold: 0 },
    { id: "p2", name: "Cacao đá", price: 25000, varCost: 11000, plannedQty: 55, trialSold: 0 },
    { id: "p3", name: "Bánh quy gói", price: 15000, varCost: 7000, plannedQty: 60, trialSold: 0 }
  ],
  fixedCosts: [
    { id: "f1", name: "Phí thuê gian", amount: 300000, note: "Một ngày hội chợ" },
    { id: "f2", name: "Trang trí và bảng giá", amount: 150000, note: "Chi một lần" },
    { id: "f3", name: "Đá, ly và khăn giấy dự phòng", amount: 100000, note: "Ước tính cho ngày bán" }
  ],
  scenarios: [
    { id: "s1", name: "Thận trọng", visitors: 100, buyRate: 55, note: "Lượng khách thấp" },
    { id: "s2", name: "Cơ sở", visitors: 150, buyRate: 65, note: "Ước tính của nhóm" }
  ],
  trialOrders: []
};

let state = loadState();

function cloneSample() {
  return JSON.parse(JSON.stringify(BTC_SAMPLE));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneSample();
    const parsed = JSON.parse(raw);
    if (
      !Array.isArray(parsed.products) ||
      !Array.isArray(parsed.fixedCosts) ||
      !Array.isArray(parsed.scenarios)
    ) {
      return cloneSample();
    }
    return {
      isSample: Boolean(parsed.isSample),
      products: parsed.products,
      fixedCosts: parsed.fixedCosts,
      scenarios: parsed.scenarios,
      trialOrders: Array.isArray(parsed.trialOrders) ? parsed.trialOrders : []
    };
  } catch {
    return cloneSample();
  }
}

function saveState(markCustom = true) {
  if (markCustom) state.isSample = false;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderAll();
}

function fmtVND(n) {
  return `${Math.round(Number(n) || 0).toLocaleString("vi-VN")} đ`;
}

function fmtNum(n) {
  return `${Math.round(Number(n) || 0).toLocaleString("vi-VN")}`;
}

function allocateIntegerByWeights(totalUnits, weights) {
  const sumW = weights.reduce((a, b) => a + Math.max(0, Number(b) || 0), 0);
  if (totalUnits <= 0 || sumW <= 0) {
    return weights.map(() => 0);
  }
  const raw = weights.map((w, idx) => {
    const exact = (totalUnits * Math.max(0, Number(w) || 0)) / sumW;
    const floorVal = Math.floor(exact);
    return { idx, exact, floorVal, rem: exact - floorVal };
  });
  const remainder = totalUnits - raw.reduce((acc, item) => acc + item.floorVal, 0);
  const sortedByRem = [...raw].sort((a, b) => b.rem - a.rem);
  for (let i = 0; i < remainder; i++) {
    sortedByRem[i % sortedByRem.length].floorVal += 1;
  }
  const result = new Array(weights.length).fill(0);
  raw.forEach((item) => {
    result[item.idx] = item.floorVal;
  });
  return result;
}

function computeBaseMetrics() {
  const totalPlannedQty = state.products.reduce(
    (s, p) => s + (Number(p.plannedQty) || 0),
    0
  );
  const expectedRevenue = state.products.reduce(
    (s, p) => s + (Number(p.price) || 0) * (Number(p.plannedQty) || 0),
    0
  );
  const totalVarCost = state.products.reduce(
    (s, p) => s + (Number(p.varCost) || 0) * (Number(p.plannedQty) || 0),
    0
  );
  const expectedGrossProfit = expectedRevenue - totalVarCost;
  const totalFixedCost = state.fixedCosts.reduce(
    (s, f) => s + (Number(f.amount) || 0),
    0
  );
  const expectedNetProfit = expectedGrossProfit - totalFixedCost;

  const avgContributionPerUnit =
    totalPlannedQty > 0 ? expectedGrossProfit / totalPlannedQty : 0;
  const breakEvenUnits =
    avgContributionPerUnit > 0
      ? Math.ceil(totalFixedCost / avgContributionPerUnit)
      : null;

  const trialSoldQty = state.products.reduce(
    (s, p) => s + (Number(p.trialSold) || 0),
    0
  );
  const trialRevenue = state.trialOrders.reduce(
    (s, o) => s + (Number(o.total) || 0),
    0
  );

  return {
    totalPlannedQty,
    expectedRevenue,
    totalVarCost,
    expectedGrossProfit,
    totalFixedCost,
    expectedNetProfit,
    avgContributionPerUnit,
    breakEvenUnits,
    trialSoldQty,
    trialRevenue
  };
}

function renderAll() {
  renderBadgeAndAssumptions();
  renderKPIs();
  renderProducts();
  renderFixedCosts();
  renderTrialControls();
  renderTrialLog();
  renderScenarios();
}

function renderBadgeAndAssumptions() {
  const badge = document.getElementById("dataSourceBadge");
  if (!badge) return;

  if (state.isSample) {
    badge.className = "badge badge-btc";
    badge.textContent = "Đang dùng dữ liệu mẫu BTC";
  } else {
    badge.className = "badge badge-custom";
    badge.textContent = "Đã chỉnh sửa giả định bởi nhóm";
  }

  const ratioStr = state.products.map((p) => Number(p.plannedQty) || 0).join(":");
  const scenStr = state.scenarios
    .map((s) => `${s.name}: ${s.visitors} lượt (${s.buyRate}%)`)
    .join(" · ");
  const m = computeBaseMetrics();

  document.getElementById("activeAssumptions").innerHTML = `
    <div><strong>Nguồn dữ liệu:</strong> ${
      state.isSample ? "Dữ liệu mẫu BTC (bảng Kinh tế)" : "Giả định nhóm tùy chỉnh"
    }</div>
    <div><strong>Tỷ trọng phần dự kiến:</strong> ${ratioStr} (Tổng ${fmtNum(
    m.totalPlannedQty
  )} phần)</div>
    <div><strong>Chi phí cố định:</strong> ${fmtVND(m.totalFixedCost)} (${
    state.fixedCosts.length
  } khoản)</div>
    <div><strong>Kịch bản khách:</strong> ${scenStr || "Chưa có"}</div>
  `;
}

function renderKPIs() {
  const m = computeBaseMetrics();
  const breakevenText =
    m.breakEvenUnits !== null
      ? `${fmtNum(m.breakEvenUnits)} phần`
      : "Không xác định (lãi góp ≤ 0)";
  const breakevenFormula =
    m.breakEvenUnits !== null
      ? `⌈${fmtVND(m.totalFixedCost)} ÷ (${fmtNum(
          m.expectedGrossProfit
        )} đ ÷ ${fmtNum(m.totalPlannedQty)} phần)⌉`
      : "Cần tổng lãi gộp dự kiến lớn hơn 0 đ";

  const cards = [
    {
      label: "Doanh thu dự kiến",
      value: fmtVND(m.expectedRevenue),
      formula: "Σ (Giá bán/phần × Số phần dự kiến)"
    },
    {
      label: "Tổng chi phí biến đổi dự kiến",
      value: fmtVND(m.totalVarCost),
      formula: "Σ (Biến phí/phần × Số phần dự kiến)"
    },
    {
      label: "Chi phí cố định",
      value: fmtVND(m.totalFixedCost),
      formula: "Σ Số tiền các khoản chi cố định"
    },
    {
      label: "Lợi nhuận dự kiến",
      value: fmtVND(m.expectedNetProfit),
      formula: `Doanh thu (${fmtVND(m.expectedRevenue)}) − Biến phí (${fmtVND(
        m.totalVarCost
      )}) − Cố định (${fmtVND(m.totalFixedCost)})`
    },
    {
      label: "Số phần cần bán để hòa vốn",
      value: breakevenText,
      formula: `⌈Chi phí cố định ÷ (Lãi gộp dự kiến ÷ Tổng phần)⌉ = ${breakevenFormula}`
    },
    {
      label: "Doanh thu bán thử hiện tại",
      value: fmtVND(m.trialRevenue),
      formula: `Đã bán thử ${fmtNum(m.trialSoldQty)} phần qua ${
        state.trialOrders.length
      } đơn`
    }
  ];

  document.getElementById("kpiGrid").innerHTML = cards
    .map(
      (c) => `
    <div class="kpi-card">
      <div class="kpi-label">${c.label}</div>
      <div class="kpi-value">${c.value}</div>
      <div class="kpi-formula">${c.formula}</div>
    </div>
  `
    )
    .join("");
}

function renderProducts() {
  const tbody = document.getElementById("productTableBody");
  tbody.innerHTML = state.products
    .map(
      (p) => `
    <tr>
      <td><input type="text" value="${escapeAttr(p.name)}" data-pid="${
        p.id
      }" data-field="name" /></td>
      <td><input type="number" class="num" min="0" step="500" value="${
        Number(p.price) || 0
      }" data-pid="${p.id}" data-field="price" /></td>
      <td><input type="number" class="num" min="0" step="500" value="${
        Number(p.varCost) || 0
      }" data-pid="${p.id}" data-field="varCost" /></td>
      <td><input type="number" class="num" min="0" step="1" value="${
        Number(p.plannedQty) || 0
      }" data-pid="${p.id}" data-field="plannedQty" /></td>
      <td style="text-align:right; font-weight:600;">${fmtNum(
        p.trialSold
      )} phần</td>
      <td><button type="button" class="btn-danger-ghost" data-del-pid="${
        p.id
      }">Xóa</button></td>
    </tr>
  `
    )
    .join("");

  tbody.querySelectorAll("input").forEach((inp) => {
    inp.addEventListener("change", (e) => {
      const pid = e.target.getAttribute("data-pid");
      const field = e.target.getAttribute("data-field");
      const item = state.products.find((x) => x.id === pid);
      if (!item) return;
      if (field === "name") {
        item.name = e.target.value.trim() || "Sản phẩm chưa đặt tên";
      } else {
        const val = Number(e.target.value);
        if (!Number.isFinite(val) || val < 0) {
          showTrialFeedback("Giá trị sản phẩm phải là số không âm.", false);
          return;
        }
        item[field] = val;
      }
      saveState(true);
    });
  });

  tbody.querySelectorAll("[data-del-pid]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (state.products.length <= 1) {
        showTrialFeedback("Cần giữ ít nhất 1 sản phẩm trong bảng.", false);
        return;
      }
      const pid = btn.getAttribute("data-del-pid");
      state.products = state.products.filter((x) => x.id !== pid);
      saveState(true);
    });
  });
}

function renderFixedCosts() {
  const tbody = document.getElementById("fixedTableBody");
  tbody.innerHTML = state.fixedCosts
    .map(
      (f) => `
    <tr>
      <td><input type="text" value="${escapeAttr(f.name)}" data-fid="${
        f.id
      }" data-field="name" /></td>
      <td><input type="number" class="num" min="0" step="1000" value="${
        Number(f.amount) || 0
      }" data-fid="${f.id}" data-field="amount" /></td>
      <td><input type="text" value="${escapeAttr(f.note || "")}" data-fid="${
        f.id
      }" data-field="note" /></td>
      <td><button type="button" class="btn-danger-ghost" data-del-fid="${
        f.id
      }">Xóa</button></td>
    </tr>
  `
    )
    .join("");

  tbody.querySelectorAll("input").forEach((inp) => {
    inp.addEventListener("change", (e) => {
      const fid = e.target.getAttribute("data-fid");
      const field = e.target.getAttribute("data-field");
      const item = state.fixedCosts.find((x) => x.id === fid);
      if (!item) return;
      if (field === "amount") {
        const val = Number(e.target.value);
        if (!Number.isFinite(val) || val < 0) {
          showTrialFeedback("Khoản chi cố định phải là số không âm.", false);
          return;
        }
        item.amount = val;
      } else {
        item[field] = e.target.value;
      }
      saveState(true);
    });
  });

  tbody.querySelectorAll("[data-del-fid]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const fid = btn.getAttribute("data-del-fid");
      state.fixedCosts = state.fixedCosts.filter((x) => x.id !== fid);
      saveState(true);
    });
  });
}

function renderTrialControls() {
  const sel = document.getElementById("trialProduct");
  const currentVal = sel.value;
  sel.innerHTML = state.products
    .map(
      (p) =>
        `<option value="${p.id}">${escapeHtml(p.name)} (${fmtVND(
          p.price
        )}/phần)</option>`
    )
    .join("");
  if (state.products.some((p) => p.id === currentVal)) {
    sel.value = currentVal;
  }
  updateTrialPreview();
}

function updateTrialPreview() {
  const pid = document.getElementById("trialProduct").value;
  const qty = Number(document.getElementById("trialQty").value);
  const prod = state.products.find((p) => p.id === pid);
  const box = document.getElementById("trialPreview");
  if (!prod || !Number.isInteger(qty) || qty <= 0) {
    box.innerHTML = `Thành tiền tạm tính: <strong>0 đ</strong> (nhập số lượng nguyên ≥ 1)`;
    return;
  }
  const total = (Number(prod.price) || 0) * qty;
  box.innerHTML = `Thành tiền tạm tính: <strong>${fmtVND(
    total
  )}</strong> (${qty} phần × ${fmtVND(prod.price)})`;
}

function showTrialFeedback(msg, ok) {
  const el = document.getElementById("trialFeedback");
  el.textContent = msg;
  el.className = `feedback show ${ok ? "ok" : "err"}`;
}

function renderTrialLog() {
  const tbody = document.getElementById("trialLogBody");
  const sumEl = document.getElementById("trialSummary");
  const totalQty = state.trialOrders.reduce(
    (s, o) => s + (Number(o.qty) || 0),
    0
  );
  const totalAmt = state.trialOrders.reduce(
    (s, o) => s + (Number(o.total) || 0),
    0
  );
  sumEl.textContent = `${state.trialOrders.length} đơn · ${fmtNum(
    totalQty
  )} phần · ${fmtVND(totalAmt)}`;

  if (state.trialOrders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="color:var(--muted);">Chưa có đơn bán thử nào được lưu.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.trialOrders
    .map(
      (o) => `
    <tr>
      <td>${escapeHtml(o.productName)}</td>
      <td style="text-align:right;">${fmtNum(o.qty)} phần</td>
      <td style="text-align:right;">${fmtVND(o.total)}</td>
      <td><button type="button" class="btn-danger-ghost" data-del-oid="${
        o.id
      }">Hủy</button></td>
    </tr>
  `
    )
    .join("");

  tbody.querySelectorAll("[data-del-oid]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const oid = btn.getAttribute("data-del-oid");
      const order = state.trialOrders.find((x) => x.id === oid);
      if (!order) return;
      const prod = state.products.find((p) => p.id === order.productId);
      if (prod) {
        prod.trialSold = Math.max(
          0,
          (Number(prod.trialSold) || 0) - (Number(order.qty) || 0)
        );
      }
      state.trialOrders = state.trialOrders.filter((x) => x.id !== oid);
      saveState(true);
      showTrialFeedback(
        "Đã hủy đơn bán thử và cập nhật lại số lượng đã bán.",
        true
      );
    });
  });
}

function renderScenarios() {
  const inputBody = document.getElementById("scenarioInputBody");
  inputBody.innerHTML = state.scenarios
    .map(
      (s) => `
    <tr>
      <td><strong>${escapeHtml(s.name)}</strong></td>
      <td><input type="number" class="num" min="0" step="1" value="${
        Number(s.visitors) || 0
      }" data-sid="${s.id}" data-field="visitors" /></td>
      <td><input type="number" class="num" min="0" max="100" step="1" value="${
        Number(s.buyRate) || 0
      }" data-sid="${s.id}" data-field="buyRate" /></td>
      <td><input type="text" value="${escapeAttr(s.note || "")}" data-sid="${
        s.id
      }" data-field="note" /></td>
    </tr>
  `
    )
    .join("");

  inputBody.querySelectorAll("input").forEach((inp) => {
    inp.addEventListener("change", (e) => {
      const sid = e.target.getAttribute("data-sid");
      const field = e.target.getAttribute("data-field");
      const sc = state.scenarios.find((x) => x.id === sid);
      if (!sc) return;
      if (field === "visitors") {
        const v = Number(e.target.value);
        if (!Number.isFinite(v) || v < 0) {
          showTrialFeedback("Lượt khách dự kiến phải ≥ 0.", false);
          return;
        }
        sc.visitors = v;
      } else if (field === "buyRate") {
        const r = Number(e.target.value);
        if (!Number.isFinite(r) || r < 0 || r > 100) {
          showTrialFeedback(
            "Tỷ lệ mua dự kiến phải nằm trong khoảng 0%–100%.",
            false
          );
          return;
        }
        sc.buyRate = r;
      } else {
        sc.note = e.target.value;
      }
      saveState(true);
    });
  });

  const m = computeBaseMetrics();
  const weights = state.products.map((p) => Number(p.plannedQty) || 0);

  const cardsHtml = state.scenarios
    .map((s) => {
      const buyersExact =
        (Number(s.visitors) || 0) * ((Number(s.buyRate) || 0) / 100);
      const buyersRounded = Math.round(buyersExact);
      const allocUnits = allocateIntegerByWeights(buyersRounded, weights);

      let rev = 0;
      let varCost = 0;
      const rowsHtml = state.products
        .map((p, idx) => {
          const q = allocUnits[idx] || 0;
          const pRev = q * (Number(p.price) || 0);
          const pVar = q * (Number(p.varCost) || 0);
          const pGross = pRev - pVar;
          rev += pRev;
          varCost += pVar;
          return `
            <tr>
              <td>${escapeHtml(p.name)}</td>
              <td style="text-align:right;">${fmtNum(q)} phần</td>
              <td style="text-align:right;">${fmtVND(pGross)}</td>
            </tr>
          `;
        })
        .join("");

      const grossProfit = rev - varCost;
      const netProfit = grossProfit - m.totalFixedCost;

      return `
        <div class="scenario-box">
          <h3>Kịch bản ${escapeHtml(
            s.name
          )} <span style="font-weight:400; color:var(--muted); font-size:0.85rem;">(${escapeHtml(
        s.note || ""
      )})</span></h3>
          <p class="hint" style="margin-bottom:8px;">
            Khách mua: ${fmtNum(s.visitors)} × ${
        s.buyRate
      }% = ${buyersExact.toFixed(1)} → <strong>${fmtNum(
        buyersRounded
      )} khách</strong> (tương đương ${fmtNum(buyersRounded)} phần nguyên)
          </p>
          <div class="table-wrap">
            <table style="min-width: 100%;">
              <thead>
                <tr>
                  <th>Món</th>
                  <th>Phân bổ</th>
                  <th>Lãi gộp</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
          <div style="margin-top:10px; font-size:0.88rem;">
            <div>Doanh thu kịch bản: <strong>${fmtVND(rev)}</strong></div>
            <div>Tổng chi phí biến đổi: <strong>${fmtVND(varCost)}</strong></div>
            <div>Tổng lãi gộp: <strong>${fmtVND(grossProfit)}</strong></div>
            <div>Chi phí cố định: <strong>${fmtVND(
              m.totalFixedCost
            )}</strong></div>
            <div style="margin-top:4px; font-size:0.96rem;">Lợi nhuận dự kiến: <strong>${fmtVND(
              netProfit
            )}</strong></div>
          </div>
        </div>
      `;
    })
    .join("");

  document.getElementById("scenarioResultCards").innerHTML = cardsHtml;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/'/g, "&#39;");
}

function initApp() {
  const btnLoadSample = document.getElementById("btnLoadSample");
  const btnAddProduct = document.getElementById("btnAddProduct");
  const btnAddFixed = document.getElementById("btnAddFixed");
  const trialProduct = document.getElementById("trialProduct");
  const trialQty = document.getElementById("trialQty");
  const trialForm = document.getElementById("trialForm");

  if (btnLoadSample) {
    btnLoadSample.addEventListener("click", () => {
      state = cloneSample();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      renderAll();
      showTrialFeedback(
        "Đã nạp lại dữ liệu mẫu BTC cho bảng Kinh tế.",
        true
      );
    });
  }

  if (btnAddProduct) {
    btnAddProduct.addEventListener("click", () => {
      state.products.push({
        id: "p_" + Date.now(),
        name: "Món mới",
        price: 20000,
        varCost: 10000,
        plannedQty: 20,
        trialSold: 0
      });
      saveState(true);
    });
  }

  if (btnAddFixed) {
    btnAddFixed.addEventListener("click", () => {
      state.fixedCosts.push({
        id: "f_" + Date.now(),
        name: "Khoản chi mới",
        amount: 50000,
        note: "Ước tính"
      });
      saveState(true);
    });
  }

  if (trialProduct) {
    trialProduct.addEventListener("change", updateTrialPreview);
  }
  if (trialQty) {
    trialQty.addEventListener("input", updateTrialPreview);
  }

  if (trialForm) {
    trialForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const pid = document.getElementById("trialProduct").value;
      const qty = Number(document.getElementById("trialQty").value);
      const prod = state.products.find((p) => p.id === pid);

      if (!prod) {
        showTrialFeedback("Vui lòng chọn sản phẩm hợp lệ.", false);
        return;
      }
      if (!Number.isInteger(qty) || qty <= 0) {
        showTrialFeedback(
          "Số lượng đơn bán thử phải là số nguyên lớn hơn 0.",
          false
        );
        return;
      }

      const total = (Number(prod.price) || 0) * qty;
      prod.trialSold = (Number(prod.trialSold) || 0) + qty;
      state.trialOrders.unshift({
        id: "o_" + Date.now(),
        productId: prod.id,
        productName: prod.name,
        qty,
        total
      });

      saveState(true);
      showTrialFeedback(
        `Đã lưu đơn bán thử: ${qty} phần ${prod.name} (${fmtVND(total)}).`,
        true
      );
    });
  }

  renderAll();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}