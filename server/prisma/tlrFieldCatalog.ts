// GENERATED FILE — do not edit by hand.
// Produced by server/scripts/generate-tlr-catalog.mjs from a real TLR certification
// workbook exported from AMIS. To regenerate:
//   node server/scripts/generate-tlr-catalog.mjs <path-to-tlr.xlsx>
//
// 205 fields across 4 AMIS objects, which is the real shape of a TLR upload:
// one project row, many note rows (one per QLICI), many disbursements, one address row.
//
// Note the source workbook is a *download* from AMIS, so its formatting is AMIS's output
// convention — dates arrive as Java Date.toString() strings, for instance. What AMIS
// accepts on upload is not necessarily identical and needs confirming against an actual
// import before the export generator is trusted.
//
// dataType is inferred from sample values plus the field label, so it is a starting point
// rather than authoritative. `observed` keeps a few real values per field so a wrong
// guess is visible instead of silent.

export type TlrDataType = "text" | "integer" | "decimal" | "currency" | "percent" | "boolean" | "date";

export interface TlrFieldSpec {
  /** Stable internal code, prefixed by AMIS object so labels repeated across sheets don't collide. */
  fieldCode: string;
  /** The exact column header AMIS uses — this is what an export has to emit. */
  amisFieldName: string;
  /** Column letter in the source workbook, for tracing a field back to the sample. */
  column: string;
  sortOrder: number;
  dataType: TlrDataType;
  /** A few real values seen in the sample, for sanity-checking the inferred type. */
  observed: string[];
  /** How many sample rows carried a value; 0 means the type came from the label alone. */
  populated: number;
}

export interface TlrObjectSpec {
  amisObject: string;
  sampleRowCount: number;
  fields: TlrFieldSpec[];
}

export const TLR_MAPPING_NAME = "NMTC TLR Certification";
export const TLR_MAPPING_VERSION = "2023";

export const TLR_CATALOG: TlrObjectSpec[] = [
  {
    "amisObject": "tlr_address__c",
    "sampleRowCount": 7,
    "fields": [
      {
        "fieldCode": "tlr_address.result",
        "amisFieldName": "Result",
        "column": "A",
        "sortOrder": 1,
        "dataType": "text",
        "observed": [
          "SUCCESS"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_address.project_number",
        "amisFieldName": "Project Number",
        "column": "B",
        "sortOrder": 2,
        "dataType": "text",
        "observed": [
          "32",
          "34",
          "31",
          "35",
          "28"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_address.census_vintage_year",
        "amisFieldName": "Census Vintage Year",
        "column": "C",
        "sortOrder": 3,
        "dataType": "integer",
        "observed": [
          "2015"
        ],
        "populated": 1
      },
      {
        "fieldCode": "tlr_address.multi_cde_project_id",
        "amisFieldName": "Multi-CDE Project ID",
        "column": "D",
        "sortOrder": 4,
        "dataType": "text",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_address.investee_street_address_line_1",
        "amisFieldName": "Investee Street Address Line 1",
        "column": "E",
        "sortOrder": 5,
        "dataType": "text",
        "observed": [
          "2401 Mississippi Ave.",
          "3870 Millstone Parkway",
          "3 Weymouth Ct.",
          "12 Danforth Road",
          "1701 Macklind Avenue"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_address.investee_street_address_line_2",
        "amisFieldName": "Investee Street Address Line 2",
        "column": "F",
        "sortOrder": 6,
        "dataType": "text",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_address.investee_city",
        "amisFieldName": "Investee City",
        "column": "G",
        "sortOrder": 7,
        "dataType": "text",
        "observed": [
          "Sauget",
          "St. Charles",
          "Florissant",
          "Alton",
          "St. Louis"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_address.investee_state",
        "amisFieldName": "Investee State",
        "column": "H",
        "sortOrder": 8,
        "dataType": "text",
        "observed": [
          "IL",
          "MO"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_address.investee_zip_code",
        "amisFieldName": "Investee Zip Code",
        "column": "I",
        "sortOrder": 9,
        "dataType": "text",
        "observed": [
          "62201",
          "63301",
          "63031",
          "62002",
          "63110"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_address.investee_zip_code_4",
        "amisFieldName": "Investee Zip Code +4",
        "column": "J",
        "sortOrder": 10,
        "dataType": "text",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_address.investee_fips_code",
        "amisFieldName": "Investee FIPS Code",
        "column": "K",
        "sortOrder": 11,
        "dataType": "text",
        "observed": [
          "29189210924"
        ],
        "populated": 1
      },
      {
        "fieldCode": "tlr_address.investee_longitude_x_coordinate",
        "amisFieldName": "Investee Longitude (X-Coordinate)",
        "column": "L",
        "sortOrder": 12,
        "dataType": "decimal",
        "observed": [
          "-90.172544748661778",
          "-90.521006052114501",
          "-90.31102665248848"
        ],
        "populated": 3
      },
      {
        "fieldCode": "tlr_address.investee_latitude_y_coordinate",
        "amisFieldName": "Investee Latitude (Y-Coordinate)",
        "column": "M",
        "sortOrder": 13,
        "dataType": "decimal",
        "observed": [
          "38.60150145081807",
          "38.822261600623008",
          "38.82493804154216"
        ],
        "populated": 3
      },
      {
        "fieldCode": "tlr_address.project_street_address_line_1",
        "amisFieldName": "Project Street Address Line 1",
        "column": "N",
        "sortOrder": 14,
        "dataType": "text",
        "observed": [
          "2401 Mississippi Ave.",
          "3870 Millstone Parkway",
          "10166 W Florissant Ave",
          "620 E Broadway",
          "900 Northwest Plaza"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_address.project_street_address_line_2",
        "amisFieldName": "Project Street Address Line 2",
        "column": "O",
        "sortOrder": 15,
        "dataType": "text",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_address.project_city",
        "amisFieldName": "Project City",
        "column": "P",
        "sortOrder": 16,
        "dataType": "text",
        "observed": [
          "Sauget",
          "St. Charles",
          "Saint Louis",
          "Alton",
          "St. Ann"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_address.project_state",
        "amisFieldName": "Project State",
        "column": "Q",
        "sortOrder": 17,
        "dataType": "text",
        "observed": [
          "IL",
          "MO"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_address.project_zip_code",
        "amisFieldName": "Project Zip Code",
        "column": "R",
        "sortOrder": 18,
        "dataType": "text",
        "observed": [
          "62201",
          "63301",
          "63136",
          "62002",
          "63074"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_address.project_zip_code_4",
        "amisFieldName": "Project Zip Code +4",
        "column": "S",
        "sortOrder": 19,
        "dataType": "text",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_address.project_fips_code",
        "amisFieldName": "Project FIPS Code",
        "column": "T",
        "sortOrder": 20,
        "dataType": "text",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_address.project_longitude_x_coordinate",
        "amisFieldName": "Project Longitude (X-Coordinate)",
        "column": "U",
        "sortOrder": 21,
        "dataType": "decimal",
        "observed": [
          "-90.17254474866178",
          "-90.5210060521145",
          "-90.2797970223609",
          "-90.176517306909",
          "-90.398897807071108"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_address.project_latitude_y_coordinate",
        "amisFieldName": "Project Latitude (Y-Coordinate)",
        "column": "V",
        "sortOrder": 22,
        "dataType": "decimal",
        "observed": [
          "38.60150145081807",
          "38.82226160062301",
          "38.753105215147635",
          "38.889772314061",
          "38.73612458301811"
        ],
        "populated": 7
      }
    ]
  },
  {
    "amisObject": "tlr_disbursement__c",
    "sampleRowCount": 14,
    "fields": [
      {
        "fieldCode": "tlr_disbursement.result",
        "amisFieldName": "Result",
        "column": "A",
        "sortOrder": 1,
        "dataType": "text",
        "observed": [
          "SUCCESS"
        ],
        "populated": 14
      },
      {
        "fieldCode": "tlr_disbursement.originator_transaction_id",
        "amisFieldName": "Originator Transaction ID",
        "column": "B",
        "sortOrder": 2,
        "dataType": "text",
        "observed": [
          "L1654041001",
          "L1654281002",
          "L1655361001",
          "L1655391002",
          "L1709421001"
        ],
        "populated": 14
      },
      {
        "fieldCode": "tlr_disbursement.revolving_loan",
        "amisFieldName": "Revolving Loan",
        "column": "C",
        "sortOrder": 3,
        "dataType": "boolean",
        "observed": [
          "false"
        ],
        "populated": 14
      },
      {
        "fieldCode": "tlr_disbursement.record_type_of_new_record",
        "amisFieldName": "Record Type of New Record",
        "column": "D",
        "sortOrder": 4,
        "dataType": "text",
        "observed": [
          "012t0000000PLlfAAG"
        ],
        "populated": 14
      },
      {
        "fieldCode": "tlr_disbursement.disbursement_date",
        "amisFieldName": "Disbursement Date",
        "column": "E",
        "sortOrder": 5,
        "dataType": "date",
        "observed": [
          "Thu Mar 17 00:00:00 GMT 2022",
          "Thu Dec 22 00:00:00 GMT 2022",
          "Wed Dec 28 00:00:00 GMT 2022",
          "Thu Apr 06 00:00:00 GMT 2023",
          "Thu Jul 28 00:00:00 GMT 2016"
        ],
        "populated": 14
      },
      {
        "fieldCode": "tlr_disbursement.qei_name",
        "amisFieldName": "QEI Name",
        "column": "F",
        "sortOrder": 6,
        "dataType": "text",
        "observed": [
          "QEI00014512",
          "QEI00014511",
          "QEI00014951",
          "QEI00006730",
          "QEI00006731"
        ],
        "populated": 14
      },
      {
        "fieldCode": "tlr_disbursement.amis_number",
        "amisFieldName": "AMIS Number",
        "column": "G",
        "sortOrder": 7,
        "dataType": "text",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_disbursement.source_amount",
        "amisFieldName": "Source Amount",
        "column": "H",
        "sortOrder": 8,
        "dataType": "currency",
        "observed": [
          "4957900.00",
          "1797100.00",
          "2845600.00",
          "1014400.00",
          "7690354.00"
        ],
        "populated": 14
      }
    ]
  },
  {
    "amisObject": "tlr_note__c",
    "sampleRowCount": 14,
    "fields": [
      {
        "fieldCode": "tlr_note.sub_cde",
        "amisFieldName": "Sub-CDE",
        "column": "A",
        "sortOrder": 1,
        "dataType": "text",
        "observed": [
          "32",
          "34",
          "31",
          "28",
          "29"
        ],
        "populated": 14
      },
      {
        "fieldCode": "tlr_note.project_number",
        "amisFieldName": "Project Number",
        "column": "B",
        "sortOrder": 2,
        "dataType": "text",
        "observed": [
          "TLRP-00021987",
          "TLRP-00021988",
          "TLRP-00023892",
          "TLRP-00002602",
          "TLRP-00000948"
        ],
        "populated": 14
      },
      {
        "fieldCode": "tlr_note.originator_transaction_id",
        "amisFieldName": "Originator Transaction ID",
        "column": "C",
        "sortOrder": 3,
        "dataType": "text",
        "observed": [
          "L1654041001",
          "L1654281002",
          "L1655361001",
          "L1655391002",
          "L1709421001"
        ],
        "populated": 14
      },
      {
        "fieldCode": "tlr_note.purpose",
        "amisFieldName": "Purpose",
        "column": "D",
        "sortOrder": 4,
        "dataType": "text",
        "observed": [
          "BUSINESS",
          "RECOCOM",
          "RERHCOM"
        ],
        "populated": 14
      },
      {
        "fieldCode": "tlr_note.transaction_type",
        "amisFieldName": "Transaction Type",
        "column": "E",
        "sortOrder": 5,
        "dataType": "text",
        "observed": [
          "TERM",
          "EQTYINV"
        ],
        "populated": 14
      },
      {
        "fieldCode": "tlr_note.loan_status",
        "amisFieldName": "Loan Status",
        "column": "F",
        "sortOrder": 6,
        "dataType": "text",
        "observed": [
          "ACTIVE",
          "SOLD"
        ],
        "populated": 14
      },
      {
        "fieldCode": "tlr_note.date_originated",
        "amisFieldName": "Date Originated",
        "column": "G",
        "sortOrder": 7,
        "dataType": "date",
        "observed": [
          "Thu Mar 17 00:00:00 GMT 2022",
          "Thu Dec 22 00:00:00 GMT 2022",
          "Wed Dec 28 00:00:00 GMT 2022",
          "Thu Apr 06 00:00:00 GMT 2023",
          "Wed Dec 28 00:00:00 GMT 2016"
        ],
        "populated": 14
      },
      {
        "fieldCode": "tlr_note.original_loan_investment_amount",
        "amisFieldName": "Original Loan/Investment Amount",
        "column": "H",
        "sortOrder": 8,
        "dataType": "currency",
        "observed": [
          "4957900.00",
          "1797100.00",
          "2845600.00",
          "1014400.00",
          "7690354.00"
        ],
        "populated": 14
      },
      {
        "fieldCode": "tlr_note.refinancing",
        "amisFieldName": "Refinancing",
        "column": "I",
        "sortOrder": 9,
        "dataType": "text",
        "observed": [
          "NEWORIGINATION",
          "REFINANCEALLOC"
        ],
        "populated": 14
      },
      {
        "fieldCode": "tlr_note.construction_or_permanent_financing",
        "amisFieldName": "Construction or Permanent Financing",
        "column": "J",
        "sortOrder": 10,
        "dataType": "text",
        "observed": [
          "PERMANENT"
        ],
        "populated": 4
      },
      {
        "fieldCode": "tlr_note.take_out_or_acquisition_financing",
        "amisFieldName": "Take-out or Acquisition Financing",
        "column": "K",
        "sortOrder": 11,
        "dataType": "text",
        "observed": [
          "TAKEOUT",
          "ACQUISITION"
        ],
        "populated": 4
      },
      {
        "fieldCode": "tlr_note.acquisition_or_rehabilitation",
        "amisFieldName": "Acquisition or Rehabilitation",
        "column": "L",
        "sortOrder": 12,
        "dataType": "text",
        "observed": [
          "ACQUISITIONREHAB"
        ],
        "populated": 2
      },
      {
        "fieldCode": "tlr_note.rehabilitation_amount",
        "amisFieldName": "Rehabilitation Amount",
        "column": "M",
        "sortOrder": 13,
        "dataType": "currency",
        "observed": [
          "5165894.00",
          "1955278.00"
        ],
        "populated": 2
      },
      {
        "fieldCode": "tlr_note.loan_origination_fees",
        "amisFieldName": "Loan Origination Fees",
        "column": "N",
        "sortOrder": 14,
        "dataType": "currency",
        "observed": [
          "0.00"
        ],
        "populated": 12
      },
      {
        "fieldCode": "tlr_note.interest_rate_at_origination",
        "amisFieldName": "Interest Rate at Origination",
        "column": "O",
        "sortOrder": 15,
        "dataType": "percent",
        "observed": [
          "2.069",
          "1.256",
          "1.162",
          "1.313",
          "3.150"
        ],
        "populated": 12
      },
      {
        "fieldCode": "tlr_note.interest_type",
        "amisFieldName": "Interest Type",
        "column": "P",
        "sortOrder": 16,
        "dataType": "text",
        "observed": [
          "FIXED"
        ],
        "populated": 12
      },
      {
        "fieldCode": "tlr_note.points",
        "amisFieldName": "Points",
        "column": "Q",
        "sortOrder": 17,
        "dataType": "decimal",
        "observed": [
          "0.000"
        ],
        "populated": 12
      },
      {
        "fieldCode": "tlr_note.amortization_type",
        "amisFieldName": "Amortization Type",
        "column": "R",
        "sortOrder": 18,
        "dataType": "text",
        "observed": [
          "PARTAMORT"
        ],
        "populated": 12
      },
      {
        "fieldCode": "tlr_note.length_of_amortization_period",
        "amisFieldName": "Length of Amortization Period",
        "column": "S",
        "sortOrder": 19,
        "dataType": "integer",
        "observed": [
          "276",
          "312",
          "239",
          "408"
        ],
        "populated": 12
      },
      {
        "fieldCode": "tlr_note.period_of_interest_only_payments",
        "amisFieldName": "Period of Interest Only Payments",
        "column": "T",
        "sortOrder": 20,
        "dataType": "integer",
        "observed": [
          "84",
          "93",
          "85",
          "72"
        ],
        "populated": 12
      },
      {
        "fieldCode": "tlr_note.term",
        "amisFieldName": "Term",
        "column": "U",
        "sortOrder": 21,
        "dataType": "integer",
        "observed": [
          "360",
          "405",
          "324",
          "480"
        ],
        "populated": 12
      },
      {
        "fieldCode": "tlr_note.guarantee",
        "amisFieldName": "Guarantee",
        "column": "V",
        "sortOrder": 22,
        "dataType": "text",
        "observed": [
          "OTHER",
          "PERSONAL",
          "NONE"
        ],
        "populated": 12
      },
      {
        "fieldCode": "tlr_note.lien_position",
        "amisFieldName": "Lien Position",
        "column": "W",
        "sortOrder": 23,
        "dataType": "text",
        "observed": [
          "FIRST",
          "SECOND"
        ],
        "populated": 12
      },
      {
        "fieldCode": "tlr_note.collateral_type",
        "amisFieldName": "Collateral Type",
        "column": "X",
        "sortOrder": 24,
        "dataType": "text",
        "observed": [
          "EQUIP",
          "RE"
        ],
        "populated": 12
      },
      {
        "fieldCode": "tlr_note.collateral_value_at_origination",
        "amisFieldName": "Collateral Value at Origination",
        "column": "Y",
        "sortOrder": 25,
        "dataType": "currency",
        "observed": [
          "2346360.12",
          "850489.88",
          "2265211.98",
          "807503.18",
          "7961252.95"
        ],
        "populated": 12
      },
      {
        "fieldCode": "tlr_note.equity_like_features",
        "amisFieldName": "Equity-Like Features",
        "column": "Z",
        "sortOrder": 26,
        "dataType": "text",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_note.equity_injection_amount",
        "amisFieldName": "Equity Injection Amount",
        "column": "AA",
        "sortOrder": 27,
        "dataType": "currency",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_note.advanced_purchase_commitment",
        "amisFieldName": "Advanced Purchase Commitment",
        "column": "AB",
        "sortOrder": 28,
        "dataType": "boolean",
        "observed": [
          "NO"
        ],
        "populated": 14
      },
      {
        "fieldCode": "tlr_note.seller_organization",
        "amisFieldName": "Seller Organization",
        "column": "AC",
        "sortOrder": 29,
        "dataType": "text",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_note.equity_product",
        "amisFieldName": "Equity Product",
        "column": "AD",
        "sortOrder": 30,
        "dataType": "boolean",
        "observed": [
          "NO",
          "YES"
        ],
        "populated": 14
      },
      {
        "fieldCode": "tlr_note.equity_equivalent_terms_and_conditions",
        "amisFieldName": "Equity-Equivalent Terms and Conditions",
        "column": "AE",
        "sortOrder": 31,
        "dataType": "boolean",
        "observed": [
          "NO"
        ],
        "populated": 14
      },
      {
        "fieldCode": "tlr_note.debt_with_equity_features",
        "amisFieldName": "Debt with Equity Features",
        "column": "AF",
        "sortOrder": 32,
        "dataType": "boolean",
        "observed": [
          "NO"
        ],
        "populated": 14
      },
      {
        "fieldCode": "tlr_note.subordinated_debt",
        "amisFieldName": "Subordinated Debt",
        "column": "AG",
        "sortOrder": 33,
        "dataType": "boolean",
        "observed": [
          "NO",
          "YES"
        ],
        "populated": 14
      },
      {
        "fieldCode": "tlr_note.below_market_interest_rate_origination",
        "amisFieldName": "Below Market Interest Rate Origination",
        "column": "AH",
        "sortOrder": 34,
        "dataType": "text",
        "observed": [
          "YES",
          "NA"
        ],
        "populated": 14
      },
      {
        "fieldCode": "tlr_note.comparable_interest_rate_at_origination",
        "amisFieldName": "Comparable Interest Rate at Origination",
        "column": "AI",
        "sortOrder": 35,
        "dataType": "percent",
        "observed": [
          "4.686",
          "11.000",
          "6.875",
          "7.250",
          "4.490"
        ],
        "populated": 12
      },
      {
        "fieldCode": "tlr_note.what_is_interest_rate_comparabl_at_orig",
        "amisFieldName": "What is interest Rate Comparabl at Orig?",
        "column": "AJ",
        "sortOrder": 36,
        "dataType": "text",
        "observed": [
          "BANKS"
        ],
        "populated": 12
      },
      {
        "fieldCode": "tlr_note.interest_rate_comparable_at_orig_other",
        "amisFieldName": "Interest Rate Comparable at Orig - Other",
        "column": "AK",
        "sortOrder": 37,
        "dataType": "text",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_note.lower_than_standard_origination_fees",
        "amisFieldName": "Lower than Standard Origination Fees",
        "column": "AL",
        "sortOrder": 38,
        "dataType": "boolean",
        "observed": [
          "YES",
          "NO"
        ],
        "populated": 14
      },
      {
        "fieldCode": "tlr_note.standard_origination_fees",
        "amisFieldName": "Standard Origination Fees",
        "column": "AM",
        "sortOrder": 39,
        "dataType": "currency",
        "observed": [
          "24789.50",
          "8985.50",
          "28456.00",
          "10144.00",
          "38451.77"
        ],
        "populated": 12
      },
      {
        "fieldCode": "tlr_note.longer_than_period_interest_only_payment",
        "amisFieldName": "Longer than Period Interest Only Payment",
        "column": "AN",
        "sortOrder": 40,
        "dataType": "text",
        "observed": [
          "YES",
          "NA"
        ],
        "populated": 14
      },
      {
        "fieldCode": "tlr_note.standard_period_of_interest_only_payment",
        "amisFieldName": "Standard Period of Interest Only Payment",
        "column": "AO",
        "sortOrder": 41,
        "dataType": "integer",
        "observed": [
          "24",
          "0",
          "12",
          "18"
        ],
        "populated": 12
      },
      {
        "fieldCode": "tlr_note.longer_than_standard_amortization_period",
        "amisFieldName": "Longer than Standard Amortization Period",
        "column": "AP",
        "sortOrder": 42,
        "dataType": "text",
        "observed": [
          "YES",
          "NA"
        ],
        "populated": 14
      },
      {
        "fieldCode": "tlr_note.standard_amortization_period",
        "amisFieldName": "Standard Amortization Period",
        "column": "AQ",
        "sortOrder": 43,
        "dataType": "integer",
        "observed": [
          "120",
          "84",
          "96",
          "124",
          "216"
        ],
        "populated": 12
      },
      {
        "fieldCode": "tlr_note.standard_amortization_period_comparable",
        "amisFieldName": "Standard Amortization Period Comparable?",
        "column": "AR",
        "sortOrder": 44,
        "dataType": "text",
        "observed": [
          "BANKS"
        ],
        "populated": 12
      },
      {
        "fieldCode": "tlr_note.standard_amortization_period_comp_other",
        "amisFieldName": "Standard Amortization Period Comp Other",
        "column": "AS",
        "sortOrder": 45,
        "dataType": "text",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_note.nontraditional_forms_of_collateral",
        "amisFieldName": "Nontraditional Forms of Collateral",
        "column": "AT",
        "sortOrder": 46,
        "dataType": "boolean",
        "observed": [
          "NO"
        ],
        "populated": 14
      },
      {
        "fieldCode": "tlr_note.traditional_form_of_collateral",
        "amisFieldName": "Traditional Form of Collateral",
        "column": "AU",
        "sortOrder": 47,
        "dataType": "text",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_note.traditional_collateral_comparable",
        "amisFieldName": "Traditional Collateral Comparable?",
        "column": "AV",
        "sortOrder": 48,
        "dataType": "text",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_note.traditional_collateral_comparable_other",
        "amisFieldName": "Traditional Collateral Comparable Other",
        "column": "AW",
        "sortOrder": 49,
        "dataType": "text",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_note.qlici_level",
        "amisFieldName": "QLICI Level",
        "column": "AX",
        "sortOrder": 50,
        "dataType": "text",
        "observed": [
          "ORIG",
          "REINVST"
        ],
        "populated": 14
      },
      {
        "fieldCode": "tlr_note.principal_balance_outstanding",
        "amisFieldName": "Principal Balance Outstanding",
        "column": "AY",
        "sortOrder": 51,
        "dataType": "currency",
        "observed": [
          "4957900.00",
          "1797100.00",
          "2845600.00",
          "1014400.00",
          "7690354.00"
        ],
        "populated": 14
      },
      {
        "fieldCode": "tlr_note.nre_activities_finance_amount",
        "amisFieldName": "NRE Activities Finance Amount",
        "column": "AZ",
        "sortOrder": 52,
        "dataType": "currency",
        "observed": [
          "4957900.00",
          "1797100.00",
          "2845600.00",
          "1014400.00",
          "0.00"
        ],
        "populated": 14
      },
      {
        "fieldCode": "tlr_note.new_restructured_loan_transaction_id",
        "amisFieldName": "New Restructured Loan Transaction ID",
        "column": "BA",
        "sortOrder": 53,
        "dataType": "text",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_note.days_delinquent",
        "amisFieldName": "Days Delinquent",
        "column": "BB",
        "sortOrder": 54,
        "dataType": "integer",
        "observed": [
          "0"
        ],
        "populated": 12
      },
      {
        "fieldCode": "tlr_note.number_of_60_days_or_more_delinquent",
        "amisFieldName": "Number of 60 Days or More Delinquent",
        "column": "BC",
        "sortOrder": 55,
        "dataType": "integer",
        "observed": [
          "0"
        ],
        "populated": 12
      },
      {
        "fieldCode": "tlr_note.number_of_times_the_loan_restructured",
        "amisFieldName": "Number of Times the Loan Restructured",
        "column": "BD",
        "sortOrder": 56,
        "dataType": "integer",
        "observed": [
          "0"
        ],
        "populated": 12
      },
      {
        "fieldCode": "tlr_note.amount_charged_off",
        "amisFieldName": "Amount Charged Off",
        "column": "BE",
        "sortOrder": 57,
        "dataType": "currency",
        "observed": [
          "0"
        ],
        "populated": 6
      },
      {
        "fieldCode": "tlr_note.amount_recovered",
        "amisFieldName": "Amount Recovered",
        "column": "BF",
        "sortOrder": 58,
        "dataType": "currency",
        "observed": [
          "0.00"
        ],
        "populated": 12
      },
      {
        "fieldCode": "tlr_note.actual_rate_of_return",
        "amisFieldName": "Actual Rate of Return",
        "column": "BG",
        "sortOrder": 59,
        "dataType": "percent",
        "observed": [
          "0.000"
        ],
        "populated": 2
      },
      {
        "fieldCode": "tlr_note.projected_residual_value_of_qlici",
        "amisFieldName": "Projected Residual Value of QLICI",
        "column": "BH",
        "sortOrder": 60,
        "dataType": "currency",
        "observed": [
          "0.00",
          "1796100.00",
          "1013400.00",
          "2923646.00",
          "2371000.00"
        ],
        "populated": 14
      },
      {
        "fieldCode": "tlr_note.type_of_business_loan",
        "amisFieldName": "Type of Business Loan",
        "column": "BI",
        "sortOrder": 61,
        "dataType": "text",
        "observed": [],
        "populated": 0
      }
    ]
  },
  {
    "amisObject": "tlr_project__c",
    "sampleRowCount": 7,
    "fields": [
      {
        "fieldCode": "tlr_project.result",
        "amisFieldName": "Result",
        "column": "A",
        "sortOrder": 1,
        "dataType": "text",
        "observed": [
          "SUCCESS"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.project_number",
        "amisFieldName": "Project Number",
        "column": "B",
        "sortOrder": 2,
        "dataType": "text",
        "observed": [
          "32",
          "34",
          "31",
          "35",
          "29"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.qlici_type",
        "amisFieldName": "QLICI Type",
        "column": "C",
        "sortOrder": 3,
        "dataType": "text",
        "observed": [
          "QALICB"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.investee_type",
        "amisFieldName": "Investee Type",
        "column": "D",
        "sortOrder": 4,
        "dataType": "text",
        "observed": [
          "BUS"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.multi_cde_project_id",
        "amisFieldName": "Multi-CDE Project ID",
        "column": "E",
        "sortOrder": 5,
        "dataType": "text",
        "observed": [
          "MCDE-00001923",
          "MCDE-00001916",
          "MCDE-00000892"
        ],
        "populated": 4
      },
      {
        "fieldCode": "tlr_project.project_results_from_investment_in_cde",
        "amisFieldName": "Project results from investment in CDE",
        "column": "F",
        "sortOrder": 6,
        "dataType": "boolean",
        "observed": [
          "NO"
        ],
        "populated": 4
      },
      {
        "fieldCode": "tlr_project.associated_project_number",
        "amisFieldName": "Associated Project Number",
        "column": "G",
        "sortOrder": 7,
        "dataType": "text",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_project.fiscal_year",
        "amisFieldName": "Fiscal Year",
        "column": "H",
        "sortOrder": 8,
        "dataType": "integer",
        "observed": [
          "2023",
          "2017"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.total_project_cost",
        "amisFieldName": "Total Project Cost",
        "column": "I",
        "sortOrder": 9,
        "dataType": "currency",
        "observed": [
          "7261702.00",
          "3885000.00",
          "14132633.00",
          "27472852.00",
          "16081170.00"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.total_project_cost_public_sources",
        "amisFieldName": "Total Project Cost Public Sources",
        "column": "J",
        "sortOrder": 10,
        "dataType": "currency",
        "observed": [
          "0.00",
          "3000000.00"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.total_project_cost_other_cdes",
        "amisFieldName": "Total Project Cost Other CDEs",
        "column": "K",
        "sortOrder": 11,
        "dataType": "currency",
        "observed": [
          "0.00",
          "1980000.00",
          "9800000.00",
          "7720000.00",
          "5790000.00"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.total_project_cost_private_investment",
        "amisFieldName": "Total Project Cost Private Investment",
        "column": "L",
        "sortOrder": 12,
        "dataType": "currency",
        "observed": [
          "506702.00",
          "25000.00",
          "1537633.00",
          "6952852.00",
          "2571170.00"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.estimated_annual_net_operating_income",
        "amisFieldName": "Estimated Annual Net Operating Income",
        "column": "M",
        "sortOrder": 13,
        "dataType": "currency",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_project.loan_to_value_ratio",
        "amisFieldName": "Loan-to-Value Ratio",
        "column": "N",
        "sortOrder": 14,
        "dataType": "currency",
        "observed": [
          "211.3",
          "126",
          "96",
          "68",
          "85"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.projected_debt_service_coverage_ratio",
        "amisFieldName": "Projected Debt Service Coverage Ratio",
        "column": "O",
        "sortOrder": 15,
        "dataType": "percent",
        "observed": [
          "4.99",
          "2.49",
          "1.06",
          "6.77",
          "1.1"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.loan_loss_reserve_requirement",
        "amisFieldName": "Loan Loss Reserve Requirement",
        "column": "P",
        "sortOrder": 16,
        "dataType": "currency",
        "observed": [
          "0"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.client_id",
        "amisFieldName": "Client ID",
        "column": "Q",
        "sortOrder": 17,
        "dataType": "text",
        "observed": [
          "Q1593",
          "Q1594",
          "Q1645",
          "Q1651",
          "Q1381"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.investee_tin",
        "amisFieldName": "Investee TIN",
        "column": "R",
        "sortOrder": 18,
        "dataType": "text",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_project.investee_cde_certification_number",
        "amisFieldName": "Investee CDE Certification Number",
        "column": "S",
        "sortOrder": 19,
        "dataType": "text",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_project.date_business_established",
        "amisFieldName": "Date Business Established",
        "column": "T",
        "sortOrder": 20,
        "dataType": "date",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_project.entity_structure",
        "amisFieldName": "Entity Structure",
        "column": "U",
        "sortOrder": 21,
        "dataType": "text",
        "observed": [
          "FORPROFIT",
          "NONPROFIT"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.minority_owned_or_controlled",
        "amisFieldName": "Minority Owned or Controlled",
        "column": "V",
        "sortOrder": 22,
        "dataType": "boolean",
        "observed": [
          "NO",
          "YES"
        ],
        "populated": 5
      },
      {
        "fieldCode": "tlr_project.native_owned_or_controlled_businesses",
        "amisFieldName": "Native-Owned or Controlled Businesses",
        "column": "W",
        "sortOrder": 23,
        "dataType": "text",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_project.women_owned_or_controlled",
        "amisFieldName": "Women Owned or Controlled",
        "column": "X",
        "sortOrder": 24,
        "dataType": "boolean",
        "observed": [
          "NO"
        ],
        "populated": 5
      },
      {
        "fieldCode": "tlr_project.low_income_owned_or_controlled",
        "amisFieldName": "Low-Income Owned or Controlled",
        "column": "Y",
        "sortOrder": 25,
        "dataType": "boolean",
        "observed": [
          "NO"
        ],
        "populated": 5
      },
      {
        "fieldCode": "tlr_project.race",
        "amisFieldName": "Race",
        "column": "Z",
        "sortOrder": 26,
        "dataType": "text",
        "observed": [
          "NA",
          "NG"
        ],
        "populated": 5
      },
      {
        "fieldCode": "tlr_project.hispanic_origin",
        "amisFieldName": "Hispanic Origin",
        "column": "AA",
        "sortOrder": 27,
        "dataType": "text",
        "observed": [
          "NO",
          "NA",
          "NG"
        ],
        "populated": 5
      },
      {
        "fieldCode": "tlr_project.business_description_primary",
        "amisFieldName": "Business Description - Primary",
        "column": "AB",
        "sortOrder": 28,
        "dataType": "text",
        "observed": [
          "INDUSTRIAL",
          "MIXED",
          "RETAIL",
          "COMMUNITY"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.business_description_narrative",
        "amisFieldName": "Business Description - Narrative",
        "column": "AC",
        "sortOrder": 29,
        "dataType": "text",
        "observed": [
          "Manufacture of hemp fiber",
          "Manufacture of light emitting diode products",
          "Refuge and Restoration - A revitalized facility that will house various for-profit and nonprofit commercial tenants to offer needed services to the surrounding community.",
          "\"Construction of a new accelerator, incubator, co-working space, and digital hub focused on social impact innovation\"",
          "Construction and operation of a community empowerment center."
        ],
        "populated": 5
      },
      {
        "fieldCode": "tlr_project.naics_code",
        "amisFieldName": "NAICS Code",
        "column": "AD",
        "sortOrder": 30,
        "dataType": "text",
        "observed": [
          "325220",
          "334413",
          "813319",
          "926110",
          "531120"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.annual_gross_revenue_loan_investment",
        "amisFieldName": "Annual Gross Revenue (Loan/Investment)",
        "column": "AE",
        "sortOrder": 31,
        "dataType": "currency",
        "observed": [
          "1982.37",
          "15215970.67",
          "0.00"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.annual_gross_revenue_reporting_period",
        "amisFieldName": "Annual Gross Revenue (Reporting Period)",
        "column": "AF",
        "sortOrder": 32,
        "dataType": "currency",
        "observed": [
          "227191.00",
          "23451413.00",
          "797117.00",
          "1118569.00",
          "2509792.00"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.jobs_at_time_of_loan_investment",
        "amisFieldName": "Jobs at Time of Loan/Investment",
        "column": "AG",
        "sortOrder": 33,
        "dataType": "decimal",
        "observed": [
          "0.00",
          "87.00",
          "2.00",
          "38.00",
          "11.00"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.projected_jobs_construction",
        "amisFieldName": "Projected Jobs (Construction)",
        "column": "AH",
        "sortOrder": 34,
        "dataType": "decimal",
        "observed": [
          "0.00",
          "75.00",
          "94.00",
          "29.00"
        ],
        "populated": 6
      },
      {
        "fieldCode": "tlr_project.projected_permanent_jobs_financed",
        "amisFieldName": "Projected Permanent Jobs (Financed)",
        "column": "AI",
        "sortOrder": 35,
        "dataType": "decimal",
        "observed": [
          "92.00",
          "86.00",
          "0.00",
          "22.00"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.projected_permanent_jobs_tenant",
        "amisFieldName": "Projected Permanent Jobs (Tenant)",
        "column": "AJ",
        "sortOrder": 36,
        "dataType": "decimal",
        "observed": [
          "0.00",
          "16.50",
          "249.00"
        ],
        "populated": 6
      },
      {
        "fieldCode": "tlr_project.actual_jobs_created_financed",
        "amisFieldName": "Actual Jobs Created (Financed)",
        "column": "AK",
        "sortOrder": 37,
        "dataType": "decimal",
        "observed": [
          "0.00",
          "4.00"
        ],
        "populated": 3
      },
      {
        "fieldCode": "tlr_project.actual_jobs_created_construction",
        "amisFieldName": "Actual Jobs Created (Construction)",
        "column": "AL",
        "sortOrder": 38,
        "dataType": "decimal",
        "observed": [
          "50.00",
          "67.00"
        ],
        "populated": 3
      },
      {
        "fieldCode": "tlr_project.actual_jobs_created_tenant",
        "amisFieldName": "Actual Jobs Created (Tenant)",
        "column": "AM",
        "sortOrder": 39,
        "dataType": "decimal",
        "observed": [
          "325.00",
          "0.00"
        ],
        "populated": 3
      },
      {
        "fieldCode": "tlr_project.source_of_job_estimates",
        "amisFieldName": "Source of Job Estimates",
        "column": "AN",
        "sortOrder": 40,
        "dataType": "text",
        "observed": [
          "NEWFINANCING"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.source_of_job_estimates_other",
        "amisFieldName": "Source of Job Estimates - Other",
        "column": "AO",
        "sortOrder": 41,
        "dataType": "text",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_project.job_quality_measure",
        "amisFieldName": "Job Quality Measure",
        "column": "AP",
        "sortOrder": 42,
        "dataType": "text",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_project.number_of_quality_jobs",
        "amisFieldName": "Number of Quality Jobs",
        "column": "AQ",
        "sortOrder": 43,
        "dataType": "integer",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_project.job_accessibility_measure",
        "amisFieldName": "Job Accessibility Measure",
        "column": "AR",
        "sortOrder": 44,
        "dataType": "text",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_project.number_of_accessible_jobs",
        "amisFieldName": "Number of Accessible Jobs",
        "column": "AS",
        "sortOrder": 45,
        "dataType": "integer",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_project.square_feet_of_real_estate_manufacture",
        "amisFieldName": "Square Feet of Real Estate - Manufacture",
        "column": "AT",
        "sortOrder": 46,
        "dataType": "currency",
        "observed": [
          "0.00"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.square_feet_of_real_estate_office",
        "amisFieldName": "Square Feet of Real Estate - Office",
        "column": "AU",
        "sortOrder": 47,
        "dataType": "currency",
        "observed": [
          "0.00",
          "36702.00",
          "37791.00"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.square_feet_of_real_estate_retail",
        "amisFieldName": "Square Feet of Real Estate - Retail",
        "column": "AV",
        "sortOrder": 48,
        "dataType": "currency",
        "observed": [
          "0.00",
          "14232.00",
          "71962.00"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.housing_units_sale",
        "amisFieldName": "Housing Units - Sale",
        "column": "AW",
        "sortOrder": 49,
        "dataType": "integer",
        "observed": [
          "0"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.housing_units_rental",
        "amisFieldName": "Housing Units - Rental",
        "column": "AX",
        "sortOrder": 50,
        "dataType": "integer",
        "observed": [
          "0"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.affordable_housing_units_sale",
        "amisFieldName": "Affordable Housing Units - Sale",
        "column": "AY",
        "sortOrder": 51,
        "dataType": "integer",
        "observed": [
          "0"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.affordable_housing_units_rental",
        "amisFieldName": "Affordable Housing Units - Rental",
        "column": "AZ",
        "sortOrder": 52,
        "dataType": "integer",
        "observed": [
          "0"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.community_facility",
        "amisFieldName": "Community Facility",
        "column": "BA",
        "sortOrder": 53,
        "dataType": "boolean",
        "observed": [
          "NO",
          "YES"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.capacity_of_educational_community",
        "amisFieldName": "Capacity of Educational Community",
        "column": "BB",
        "sortOrder": 54,
        "dataType": "integer",
        "observed": [
          "0",
          "60"
        ],
        "populated": 4
      },
      {
        "fieldCode": "tlr_project.capacity_of_childcare_community_facility",
        "amisFieldName": "Capacity of Childcare Community Facility",
        "column": "BC",
        "sortOrder": 55,
        "dataType": "integer",
        "observed": [
          "0"
        ],
        "populated": 4
      },
      {
        "fieldCode": "tlr_project.capacity_of_healthcare_community",
        "amisFieldName": "Capacity of Healthcare Community",
        "column": "BD",
        "sortOrder": 56,
        "dataType": "integer",
        "observed": [
          "0"
        ],
        "populated": 4
      },
      {
        "fieldCode": "tlr_project.capacity_of_arts_center_community",
        "amisFieldName": "Capacity of Arts Center Community",
        "column": "BE",
        "sortOrder": 57,
        "dataType": "integer",
        "observed": [
          "0"
        ],
        "populated": 4
      },
      {
        "fieldCode": "tlr_project.num_served_commercial_goods_or_services",
        "amisFieldName": "Num Served Commercial Goods or Services",
        "column": "BF",
        "sortOrder": 58,
        "dataType": "integer",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_project.num_served_community_goods_or_services",
        "amisFieldName": "Num Served Community Goods or Services",
        "column": "BG",
        "sortOrder": 59,
        "dataType": "integer",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_project.num_of_hh_served_infrastructure_services",
        "amisFieldName": "Num of HH Served Infrastructure Services",
        "column": "BH",
        "sortOrder": 60,
        "dataType": "integer",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_project.environmental_sustainability_measure",
        "amisFieldName": "Environmental Sustainability Measure",
        "column": "BI",
        "sortOrder": 61,
        "dataType": "text",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_project.environmental_sustainability_outcome",
        "amisFieldName": "Environmental Sustainability Outcome",
        "column": "BJ",
        "sortOrder": 62,
        "dataType": "text",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_project.qalicb_type",
        "amisFieldName": "QALICB Type",
        "column": "BK",
        "sortOrder": 63,
        "dataType": "text",
        "observed": [
          "NRE",
          "RE",
          "SPE"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.nmtc_eligibility_criteria",
        "amisFieldName": "NMTC Eligibility Criteria",
        "column": "BL",
        "sortOrder": 64,
        "dataType": "text",
        "observed": [
          "2011-2015ACS",
          "LIC_TRACTS",
          "2006-2010ACS"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.related_entity",
        "amisFieldName": "Related Entity",
        "column": "BM",
        "sortOrder": 65,
        "dataType": "boolean",
        "observed": [
          "NO"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.upfront_fees_to_investors",
        "amisFieldName": "Upfront Fees to Investors",
        "column": "BN",
        "sortOrder": 66,
        "dataType": "currency",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_project.upfront_fees_to_the_cde_or_cde_affiliate",
        "amisFieldName": "Upfront Fees to the CDE or CDE Affiliate",
        "column": "BO",
        "sortOrder": 67,
        "dataType": "currency",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_project.upfront_fees_to_unaffiliated_parties",
        "amisFieldName": "Upfront Fees to Unaffiliated Parties",
        "column": "BP",
        "sortOrder": 68,
        "dataType": "currency",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_project.ongoing_fees_paid_to_investors",
        "amisFieldName": "Ongoing Fees Paid to Investors",
        "column": "BQ",
        "sortOrder": 69,
        "dataType": "currency",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_project.ongoing_fees_to_the_cde_or_cde_affiliate",
        "amisFieldName": "Ongoing Fees to the CDE or CDE Affiliate",
        "column": "BR",
        "sortOrder": 70,
        "dataType": "currency",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_project.ongoing_fees_to_unaffiliated_parties",
        "amisFieldName": "Ongoing Fees to Unaffiliated Parties",
        "column": "BS",
        "sortOrder": 71,
        "dataType": "currency",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_project.total_qei_proceeds_retained_by_the_cde",
        "amisFieldName": "Total QEI Proceeds Retained by the CDE",
        "column": "BT",
        "sortOrder": 72,
        "dataType": "currency",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_project.back_end_fees_to_investors",
        "amisFieldName": "Back-end Fees to Investors",
        "column": "BU",
        "sortOrder": 73,
        "dataType": "currency",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_project.back_end_fees_to_cde_or_cde_affiliates",
        "amisFieldName": "Back-end Fees to CDE or CDE Affiliates",
        "column": "BV",
        "sortOrder": 74,
        "dataType": "currency",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_project.back_end_fees_to_unaffiliated_parties",
        "amisFieldName": "Back-end Fees to Unaffiliated Parties",
        "column": "BW",
        "sortOrder": 75,
        "dataType": "currency",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_project.upfront_transaction_costs",
        "amisFieldName": "Upfront Transaction Costs",
        "column": "BX",
        "sortOrder": 76,
        "dataType": "currency",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_project.ongoing_transaction_costs",
        "amisFieldName": "Ongoing Transaction Costs",
        "column": "BY",
        "sortOrder": 77,
        "dataType": "currency",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_project.back_end_transaction_costs",
        "amisFieldName": "Back-end Transaction Costs",
        "column": "BZ",
        "sortOrder": 78,
        "dataType": "currency",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_project.below_market_interest_rate_at_orig",
        "amisFieldName": "Below Market Interest Rate at Orig",
        "column": "CA",
        "sortOrder": 79,
        "dataType": "boolean",
        "observed": [
          "Yes"
        ],
        "populated": 1
      },
      {
        "fieldCode": "tlr_project.blended_interest_rate_at_origination",
        "amisFieldName": "Blended Interest Rate at Origination",
        "column": "CB",
        "sortOrder": 80,
        "dataType": "percent",
        "observed": [
          "1.31"
        ],
        "populated": 1
      },
      {
        "fieldCode": "tlr_project.comparable_blended_interest_rate_at_orig",
        "amisFieldName": "Comparable Blended Interest Rate at Orig",
        "column": "CC",
        "sortOrder": 81,
        "dataType": "percent",
        "observed": [
          "7.25"
        ],
        "populated": 1
      },
      {
        "fieldCode": "tlr_project.lower_than_standard_origination_fees",
        "amisFieldName": "Lower than Standard Origination Fees",
        "column": "CD",
        "sortOrder": 82,
        "dataType": "boolean",
        "observed": [
          "YES"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.standard_origination_fees_project",
        "amisFieldName": "Standard Origination Fees (Project)",
        "column": "CE",
        "sortOrder": 83,
        "dataType": "currency",
        "observed": [
          "33775.00",
          "38600.00",
          "53075.00",
          "77200.00",
          "57900.00"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.higher_than_standard_loan_to_value_ratio",
        "amisFieldName": "Higher than Standard Loan to Value Ratio",
        "column": "CF",
        "sortOrder": 84,
        "dataType": "boolean",
        "observed": [
          "YES",
          "NO"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.standard_loan_to_value_ratio",
        "amisFieldName": "Standard Loan to Value Ratio",
        "column": "CG",
        "sortOrder": 85,
        "dataType": "currency",
        "observed": [
          "75.000"
        ],
        "populated": 6
      },
      {
        "fieldCode": "tlr_project.more_flexible_borrower_credit_standards",
        "amisFieldName": "More Flexible Borrower Credit Standards",
        "column": "CH",
        "sortOrder": 86,
        "dataType": "boolean",
        "observed": [
          "YES",
          "NO"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.lower_than_standard_debt_service_ratio",
        "amisFieldName": "Lower than Standard Debt Service Ratio",
        "column": "CI",
        "sortOrder": 87,
        "dataType": "boolean",
        "observed": [
          "NO",
          "YES"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.standard_debt_service_coverage_ratio",
        "amisFieldName": "Standard Debt Service Coverage Ratio",
        "column": "CJ",
        "sortOrder": 88,
        "dataType": "percent",
        "observed": [
          "1.250"
        ],
        "populated": 2
      },
      {
        "fieldCode": "tlr_project.lower_than_standard_loan_loss_req",
        "amisFieldName": "Lower than Standard Loan Loss Req",
        "column": "CK",
        "sortOrder": 89,
        "dataType": "boolean",
        "observed": [
          "NO"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.standard_loan_loss_reserve_requirement",
        "amisFieldName": "Standard Loan Loss Reserve Requirement",
        "column": "CL",
        "sortOrder": 90,
        "dataType": "currency",
        "observed": [],
        "populated": 0
      },
      {
        "fieldCode": "tlr_project.poverty_greater_than_25_less_than_30",
        "amisFieldName": "Poverty greater than 25% less than 30%",
        "column": "CM",
        "sortOrder": 91,
        "dataType": "boolean",
        "observed": [
          "NO"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.poverty_rates_greater_than_30",
        "amisFieldName": "Poverty Rates greater than 30%",
        "column": "CN",
        "sortOrder": 92,
        "dataType": "boolean",
        "observed": [
          "YES",
          "NO"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.med_inc_less_than_60_of_area_med_inc",
        "amisFieldName": "Med Inc less than 60% of Area Med Inc",
        "column": "CO",
        "sortOrder": 93,
        "dataType": "boolean",
        "observed": [
          "YES",
          "NO"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.median_income_60_70_area_median_income",
        "amisFieldName": "Median Income 60-70% Area Median Income",
        "column": "CP",
        "sortOrder": 94,
        "dataType": "boolean",
        "observed": [
          "NO"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.unemployment_rates_1_25_1_5_nation_avg",
        "amisFieldName": "Unemployment rates 1.25 - 1.5 Nation AVG",
        "column": "CQ",
        "sortOrder": 95,
        "dataType": "boolean",
        "observed": [
          "NO"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.unemployment_rates_1_5x_national_average",
        "amisFieldName": "Unemployment rates 1.5X national average",
        "column": "CR",
        "sortOrder": 96,
        "dataType": "boolean",
        "observed": [
          "YES",
          "NO"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.designated_for_redevelopment",
        "amisFieldName": "Designated for Redevelopment",
        "column": "CS",
        "sortOrder": 97,
        "dataType": "boolean",
        "observed": [
          "NO"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.designated_ez_ec_or_rc",
        "amisFieldName": "Designated EZ EC or RC",
        "column": "CT",
        "sortOrder": 98,
        "dataType": "boolean",
        "observed": [
          "NO"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.sba_designated_hub_zone",
        "amisFieldName": "SBA Designated HUB Zone",
        "column": "CU",
        "sortOrder": 99,
        "dataType": "boolean",
        "observed": [
          "NO",
          "YES"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.designated_native_american",
        "amisFieldName": "Designated Native American",
        "column": "CV",
        "sortOrder": 100,
        "dataType": "boolean",
        "observed": [
          "NO"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.brownfield_redevelopment_area",
        "amisFieldName": "Brownfield Redevelopment Area",
        "column": "CW",
        "sortOrder": 101,
        "dataType": "boolean",
        "observed": [
          "NO",
          "YES"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.encompassed_hope_vi_redevelopment_plan",
        "amisFieldName": "Encompassed HOPE VI Redevelopment Plan",
        "column": "CX",
        "sortOrder": 102,
        "dataType": "boolean",
        "observed": [
          "NO"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.located_in_a_hot_zone",
        "amisFieldName": "Located in a Hot Zone",
        "column": "CY",
        "sortOrder": 103,
        "dataType": "text",
        "observed": [
          "NO",
          "NA"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.appalachian_commission_delta_authority",
        "amisFieldName": "Appalachian  Commission/ Delta Authority",
        "column": "CZ",
        "sortOrder": 104,
        "dataType": "boolean",
        "observed": [
          "NO"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.colonias",
        "amisFieldName": "Colonias",
        "column": "DA",
        "sortOrder": 105,
        "dataType": "boolean",
        "observed": [
          "NO"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.medically_underserved_area",
        "amisFieldName": "Medically Underserved Area",
        "column": "DB",
        "sortOrder": 106,
        "dataType": "text",
        "observed": [
          "NA",
          "NO"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.tif_district_or_enterprise_zone_program",
        "amisFieldName": "TIF District or Enterprise Zone Program",
        "column": "DC",
        "sortOrder": 107,
        "dataType": "boolean",
        "observed": [
          "NO",
          "YES"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.high_migration_rural_county",
        "amisFieldName": "High Migration Rural County",
        "column": "DD",
        "sortOrder": 108,
        "dataType": "boolean",
        "observed": [
          "NO"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.non_metropolitan_census_tract",
        "amisFieldName": "Non-Metropolitan Census Tract",
        "column": "DE",
        "sortOrder": 109,
        "dataType": "boolean",
        "observed": [
          "NO"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.fema",
        "amisFieldName": "FEMA",
        "column": "DF",
        "sortOrder": 110,
        "dataType": "boolean",
        "observed": [
          "NO",
          "YES"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.taa_program",
        "amisFieldName": "TAA Program",
        "column": "DG",
        "sortOrder": 111,
        "dataType": "boolean",
        "observed": [
          "NO"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.food_desert",
        "amisFieldName": "Food Desert",
        "column": "DH",
        "sortOrder": 112,
        "dataType": "text",
        "observed": [
          "NA",
          "NO",
          "YES"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.targeted_populations",
        "amisFieldName": "Targeted Populations",
        "column": "DI",
        "sortOrder": 113,
        "dataType": "boolean",
        "observed": [
          "NO"
        ],
        "populated": 7
      },
      {
        "fieldCode": "tlr_project.other_areas_of_higher_distress",
        "amisFieldName": "Other Areas of Higher Distress",
        "column": "DJ",
        "sortOrder": 114,
        "dataType": "boolean",
        "observed": [
          "NO"
        ],
        "populated": 7
      }
    ]
  }
];

export const TLR_FIELD_COUNT = 205;
