export const demographicData = {
  sourceFile: "DemographicsNew-4.xls",
  sourceLabel: "Florida Division of Elections demographic file",
  freshnessLabel: "State demographic data • approximately one day behind county reporting",
  total: 1320275,
  ages: ["18 to 24", "25 to 34", "35 to 49", "50 to 64", "65+"],
  parties: ["Democrats", "Independent", "Republicans", "Other", "Unknown"],
  ethnicities: ["African American", "Hispanic", "White", "Other", "Unknown"],
  values: [
    [[2700,2382,5116,1735,0],[611,1191,2426,945,0],[112,1384,7361,865,0],[0,0,0,0,0],[0,0,1,0,0]],
    [[4416,3945,11142,2149,0],[854,1737,4044,1080,0],[206,1961,10114,824,0],[0,0,0,0,0],[1,0,1,0,0]],
    [[11317,7538,25987,3679,0],[2225,4541,12248,2496,0],[675,5378,27673,2184,0],[0,0,0,0,0],[0,0,0,0,0]],
    [[29057,13114,53443,5710,0],[3139,8032,24887,4015,0],[1396,13825,98238,5317,0],[0,0,0,0,0],[1,1,1,0,0]],
    [[70479,27690,255800,13720,0],[3677,12929,84659,6514,0],[2183,32261,363548,11392,0],[0,0,0,0,0],[0,0,3,0,0]]
  ]
} as const;
