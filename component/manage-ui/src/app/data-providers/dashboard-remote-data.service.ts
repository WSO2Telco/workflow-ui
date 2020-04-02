
import {throwError as observableThrowError, BehaviorSubject, Observable, ReplaySubject} from 'rxjs';
import {Injectable} from '@angular/core';
import {DashboardData, DashboardDataRequestParam, HistoryBarGraphData} from '../commons/models/dashboard-data-models';
import {ApprovalRemoteDataService} from './approval-remote-data.service';
import {ApplicationTaskResult} from '../commons/models/application-data-models';
import {SlimLoadingBarService} from 'ng2-slim-loading-bar';
import {AuthenticationService} from '../commons/services/authentication.service';
import {MessageService} from '../commons/services/message.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, map } from 'rxjs/operators';

@Injectable()
export class DashboardRemoteDataService {

    /**
     * Application Creation History Graph Data Stream
     * @type {BehaviorSubject<HistoryBarGraphData>}
     */
    public ApplicationCreationHistoryDataProvider: BehaviorSubject<any> = new BehaviorSubject<any>([]);

    /**
     * Subscription Creation History Graph Data Stream
     * @type {BehaviorSubject<HistoryBarGraphData>}
     */
    public SubscriptionCreationHistoryDataProvider: BehaviorSubject<any> = new BehaviorSubject<any>([]);

    private _dashboardStatisticsData = new DashboardData();

    private url = new URL(window.location.href);
    private apiContext = this.url.protocol + '//' + this.url.host + '/workflow-service/workflow/';

    private apiEndpoints: Object = {
        dashboardData: this.apiContext + '/applications/statistics',
        applicationGraph: this.apiContext + 'applications/graph',
        subscriptionGraph: this.apiContext + 'subscriptions/graph',
    };

    constructor(private http: HttpClient,
                private approvalService: ApprovalRemoteDataService,
                private slimLoadingBarService: SlimLoadingBarService,
                private authenticationService: AuthenticationService,
                private message: MessageService) {

        approvalService.MyApplicationApprovalTasksProvider.subscribe(
            (result) => {
                this.updateDashboardData(result, 'appCreationsForUser');
            }
        );

        approvalService.MySubscriptionTasksProvider.subscribe(
            (result) => {
                this.updateDashboardData(result, 'subCreationsForUser');
            }
        );

        approvalService.AllApplicationApprovalTasksProvider.subscribe(
            (result) => {
                this.updateDashboardData(result, 'appCreationsForGroup');
            }
        );

        approvalService.GroupSubscriptionTasksProvider.subscribe(
            (result) => {
                this.updateDashboardData(result, 'subCreationsForGroup');
            }
        );
    }

    public DashboardDataProvider: ReplaySubject<DashboardData> = new ReplaySubject();


    getDashboardData(): Observable<DashboardData> {
        const param = new DashboardDataRequestParam();
        param.assignee = 'admin';
        param.candidateGroups = 'Internal/subscriber,manage-app-admin,Internal/identity,Internal/everyone,admin';

        return this.http.post<any>(this.apiEndpoints['dashboardData'], param, this.getOptions());
    };

    updateDashboardData(result: ApplicationTaskResult, type: string): void {
        const changeObj = {};
        changeObj[type] = (result && result.metadata && result.metadata.total) || 0;
        this._dashboardStatisticsData = Object.assign({}, this._dashboardStatisticsData, changeObj);
        this._dashboardStatisticsData.totalAppCreations = this._dashboardStatisticsData.appCreationsForGroup + this._dashboardStatisticsData.appCreationsForUser;
        this._dashboardStatisticsData.totalSubCreations = this._dashboardStatisticsData.subCreationsForGroup + this._dashboardStatisticsData.subCreationsForUser;

        this.DashboardDataProvider.next(this._dashboardStatisticsData);
    }

    getApplicationCreationHistoryGraphData(): void {
        this.slimLoadingBarService.start();
        this.http.get(this.apiEndpoints['applicationGraph'], this.getOptions())
            .pipe(
                catchError((error: Response) => observableThrowError({
                    success: false,
                    message: 'Error Loading Application Creation History Graph Data',
                    error: error
                }))
            )
            .subscribe(
                graphData => {
                    if (graphData) {
                        this.ApplicationCreationHistoryDataProvider.next(graphData['payload']);
                        this.slimLoadingBarService.complete();
                    } else {
                        this.message.error(graphData['message']);
                        this.slimLoadingBarService.stop();
                    }
                },
                error => {
                    this.message.error(error.message);
                    this.slimLoadingBarService.stop();
                }
            );
    }

    getSubscriptionCreationHistoryGraphData(): void {
        this.slimLoadingBarService.start();
        this.http.get(this.apiEndpoints['subscriptionGraph'], this.getOptions())
            .pipe(
                catchError((error: Response) => observableThrowError({
                    success: false,
                    message: 'Error Loading Subscription Creation History Graph Data',
                    error: error
                }))
            )
            .subscribe(
                data => {
                    if (data) {
                        this.SubscriptionCreationHistoryDataProvider.next(data['payload']);
                        this.slimLoadingBarService.complete();
                    } else {
                        this.message.error(data['message']);
                        this.slimLoadingBarService.stop();
                    }
                },
                error => {
                    this.message.error(error.message);
                    this.slimLoadingBarService.stop();
                }
            );
    }

    getOptions() {
        const token = this.authenticationService.loginUserInfo.getValue().token;
        const useName = this.authenticationService.loginUserInfo.getValue().userName;
        const headers = new HttpHeaders(
            {
                'Authorization': 'Basic ' + token,
                'user-name': useName,
                'Content-Type': 'application/json'
            });
        return {headers: headers};
    }

}
