export function PromotionDiscountArrow({original, final}: {original: number; final: number}) {
    const discount = final > 0 && final < original ? (1 - final / original) * 100 : null
    return <span className="promotion-discount-arrow">
        <img src="/assets/panel-nav/akar-icons_arrow-down.svg" alt="" width="22" height="22" />
        {discount !== null && <small>−{discount.toLocaleString("es-AR", {maximumFractionDigits: 1})}%</small>}
    </span>
}
