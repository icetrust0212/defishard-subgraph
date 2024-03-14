import { JSONValue, TypedMap, json, log, near } from "@graphprotocol/graph-ts";
import { ZERO_BI } from "./constants";
import {Collection, User} from "../generated/schema";

export function handleNewBlock(block: near.Block): void {
  const header = block.header;
}

export function handleReceipt(receipt: near.ReceiptWithOutcome): void {
  const actions = receipt.receipt.actions;
  for (let i = 0; i < actions.length; i++) {
    handleAction(actions[i], receipt);
  }
}

function handleAction(
  action: near.ActionValue,
  receipt: near.ReceiptWithOutcome,
): void {
  if (action.kind != near.ActionKind.FUNCTION_CALL) {
    return;
  }
  const methodName = action.toFunctionCall().methodName;
  const outcome = receipt.outcome;

  for (let logIndex = 0; logIndex < outcome.logs.length; logIndex++) {
    let outcomeLog = outcome.logs[logIndex].toString();
    log.warning("Block logs {}", [outcomeLog]);
    if (outcomeLog.startsWith('EVENT_JSON:')) {
      outcomeLog = outcomeLog.replace('EVENT_JSON:', '');
      outcomeLog = outcomeLog.replace(', data_source: NFTLaunchpad, component: UserMapping', '');
      const jsonData = json.try_fromString(outcomeLog);
      const jsonObject = jsonData.value.toObject();
      const event = jsonObject.get('event')!;
      const dataArr = jsonObject.get('data')!.toArray();
      const dataObj: TypedMap<string, JSONValue> = dataArr[0].toObject();
      log.warning("Block logs {}{}", [event.toString(), jsonData.value.toString()]);

      handleEvent(methodName, event.toString(), dataObj, receipt);
    }
  }
}

function handleEvent(
  methodName: string,
  event: string,
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome
): void {
  if (methodName.toLowerCase() == "launch") {
    const creator_id = data.get("creator_id")!.toString();
    const collection_id = data.get("collection_id")!.toString();
    const name = data.get("name")!.toString();
    const symbol = data.get("symbol")!.toString();
    const totalSupply = ZERO_BI;
    
    let collection = Collection.load(collection_id);
    if (collection == null) {
      collection = new Collection(collection_id);
    }
    collection.creator = creator_id;
    collection.name = name;
    collection.symbol = symbol;
    collection.totalSupply = totalSupply;

    collection.save();

    let user = User.load(creator_id);
    if (user == null) {
      user = new User(creator_id);
    }
    user.name = creator_id;

    user.save();
  }
}