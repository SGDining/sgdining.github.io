from scripts.refresh_krisplus_partners import parse_partner_tables, parse_rate


def test_parse_rate_with_promo():
    assert parse_rate("3 mpd 5 mpd till 31 Aug '26") == (3.0, 5.0)
    assert parse_rate("0.5 mpd") == (0.5, None)


def test_parse_partner_tables_keeps_partner_scope_separate():
    html = """
    <html><body>
      <h3>Dining</h3>
      <table>
        <tr><th>Merchant</th><th>Earn Rate</th></tr>
        <tr><td>Prego (Fairmont)</td><td>5 mpd</td></tr>
        <tr><td>Cedele</td><td>5 mpd</td></tr>
      </table>
      <h3>Retail</h3>
      <table>
        <tr><th>Merchant</th><th>Earn Rate</th></tr>
        <tr><td>Skechers</td><td>2 mpd</td></tr>
      </table>
    </body></html>
    """
    rows = parse_partner_tables(html)
    assert [(r["name"], r["category"], r["earn_rate_mpd"]) for r in rows] == [
        ("Cedele", "dining", 5.0),
        ("Prego (Fairmont)", "dining", 5.0),
        ("Skechers", "retail", 2.0),
    ]
    assert all(r["outlets_verified"] is False for r in rows)
    assert all(r["map_ready"] is False for r in rows)


def test_summary_table_is_ignored():
    html = """
    <h3>Kris+ Merchants by Category</h3>
    <table>
      <tr><th>Category</th><th>Merchants</th><th>Average Earn Rate</th></tr>
      <tr><td>Dining</td><td>338</td><td>3.32 mpd</td></tr>
    </table>
    """
    assert parse_partner_tables(html) == []
