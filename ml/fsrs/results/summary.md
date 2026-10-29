| model | users | reviews | log loss | RMSE(bins) | AUC | benchmark (LL / RMSE / AUC) |
|---|---|---|---|---|---|---|
| fsrs6 | 100 | 4070535 | 0.3494±0.0455 | 0.0698±0.0108 | 0.6932±0.0262 | 0.3460 / 0.0653 / 0.7034 |
| fsrs6_default | 100 | 4070535 | 0.3686±0.0438 | 0.1009±0.0136 | 0.6846±0.0269 |  |
| fsrs6_3btn | 100 | 4070535 | 0.3510±0.0455 | 0.0714±0.0107 | 0.6862±0.0275 |  |
| gru | 100 | 4070535 | 0.3676±0.0480 | 0.0779±0.0119 | 0.6643±0.0284 | 0.3328 / 0.0549 / 0.7324 |

Weighted by reviews:

- fsrs6: log loss 0.3701, RMSE(bins) 0.0549, AUC 0.6853
- fsrs6_default: log loss 0.3824, RMSE(bins) 0.0745, AUC 0.6732
- fsrs6_3btn: log loss 0.3712, RMSE(bins) 0.0567, AUC 0.6813
- gru: log loss 0.3778, RMSE(bins) 0.0616, AUC 0.6789

Share of users where GRU is better than FSRS-6:

- log_loss: 24%
- rmse_bins: 32%
- auc: 21%
